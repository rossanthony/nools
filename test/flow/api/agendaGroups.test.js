'use strict';

const assert = require('assert');
const nools = require('../../../lib');

describe('agenda-groups', () => {
    class Message {
        constructor(name) {
            this.name = name;
        }
    }

    const agendaGroupFlow = nools.flow('agendGroups', (builder) => {
        builder.rule('Hello World', {agendaGroup: 'ag1'}, [Message, 'm', "m.name == 'hello'"], (facts, session) => {
            session.modify(facts.m, (m) => {
                m.name = 'goodbye';
            });
        });

        builder.rule('Hello World 2', {agendaGroup: 'ag2'}, [Message, 'm', "m.name == 'hello'"], (facts, session) => {
            session.modify(facts.m, (m) => {
                m.name = 'goodbye';
            });
        });

        builder.rule('GoodBye', {agendaGroup: 'ag1'}, [Message, 'm', "m.name == 'goodbye'"], () => {
            // noop
        });

        builder.rule('GoodBye 2', {agendaGroup: 'ag2'}, [Message, 'm', "m.name == 'goodbye'"], () => {
            // noop
        });
    });

    it('should only fire events in focused group', () => {
        let events = [];
        const session = agendaGroupFlow.getSession();
        session.assert(new Message('hello'));
        session.focus('ag1');
        session.on('fire', (name) => {
            events.push(name);
        });
        return session.match()
            .then(() => {
                assert.deepEqual(events, ['Hello World', 'GoodBye']);
                events = [];
                const newSession = agendaGroupFlow.getSession();
                newSession.assert(new Message('hello'));
                newSession.focus('ag2');
                newSession.on('fire', (name) => {
                    events.push(name);
                });
                return newSession.match().then(() => {
                    assert.deepEqual(events, ['Hello World 2', 'GoodBye 2']);
                });
            });
    });

    it('should should treat focus like a stack', () => {
        let events = [];
        const session = agendaGroupFlow.getSession();
        session.assert(new Message('hello'));
        session.focus('ag2');
        session.focus('ag1');
        session.focus('unknown');
        session.on('fire', (name) => {
            events.push(name);
        });
        return session.match()
            .then(() => {
                assert.deepEqual(events, ['Hello World', 'GoodBye', 'GoodBye 2']);
                events = [];
                const newSession = agendaGroupFlow.getSession();
                newSession.assert(new Message('hello'));
                newSession.focus('ag1');
                newSession.focus('ag2');
                newSession.on('fire', (name) => {
                    events.push(name);
                });
                return newSession.match().then(() => {
                    assert.deepEqual(events, ['Hello World 2', 'GoodBye 2', 'GoodBye']);
                });
            });
    });

    describe('with auto-focus', () => {
        /* jshint indent*/
        class State {
            constructor(name, state) {
                this.name = name;
                this.state = state;
            }
        }

        const autoFocusFlow = nools.flow('autoFocus', (builder) => {
            builder.rule('Bootstrap', [State, 'a', "a.name == 'A' && a.state == 'NOT_RUN'"], (facts, session) => {
                session.modify(facts.a, (a) => {
                    a.state = 'FINISHED';
                });
            });

            builder.rule('A to B',
                [
                    [State, 'a', "a.name == 'A' && a.state == 'FINISHED'"],
                    [State, 'b', "b.name == 'B' && b.state == 'NOT_RUN'"],
                ],
                (facts, session) => {
                    session.modify(facts.b, (b) => {
                        b.state = 'FINISHED';
                    });
                });

            builder.rule('B to C',
                {agendaGroup: 'B to C', autoFocus: true},
                [
                    [State, 'b', "b.name == 'B' && b.state == 'FINISHED'"],
                    [State, 'c', "c.name == 'C' && c.state == 'NOT_RUN'"],
                ],
                (facts, session) => {
                    session.modify(facts.c, (c) => {
                        c.state = 'FINISHED';
                    });
                    session.focus('B to D');
                });

            builder.rule('B to D',
                {agendaGroup: 'B to D'},
                [
                    [State, 'b', "b.name == 'B' && b.state == 'FINISHED'"],
                    [State, 'd', "d.name == 'D' && d.state == 'NOT_RUN'"],
                ],
                (facts, session) => {
                    session.modify(facts.d, (d) => {
                        d.state = 'FINISHED';
                    });
                });
        });

        it('should activate agenda groups in proper order', () => {
            const session = autoFocusFlow.getSession();
            session.assert(new State('A', 'NOT_RUN'));
            session.assert(new State('B', 'NOT_RUN'));
            session.assert(new State('C', 'NOT_RUN'));
            session.assert(new State('D', 'NOT_RUN'));
            const fired = [];
            session.on('fire', (name) => {
                fired.push(name);
            });
            return session.match().then(() => {
                assert.deepEqual(fired, ['Bootstrap', 'A to B', 'B to C', 'B to D']);
            });
        });
    });
});
