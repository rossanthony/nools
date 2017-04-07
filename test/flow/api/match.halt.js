'use strict';

const assert = require('assert');
const nools = require('../../../lib');

describe('#matchHalt', () => {
    class Count {
        constructor(count) {
            this.count = count;
        }
    }

    const haltFlow = nools.flow('Match with halt Flow', (builder) => {
        builder.rule('Stop', [Count, 'c', 'c.count == 6'], (facts, session) => {
            session.halt();
        });

        builder.rule('Inc', [Count, 'c'], (facts, session) => {
            facts.c.count += 1;
            session.modify(facts.c);
        });
    });

    it('should stop match with halt', () => {
        const session = haltFlow.getSession(new Count(0));
        return session.match().then((err) => {
            assert(!err);
            assert.equal(session.getFacts(Count)[0].count, 6);
        });
    });
});
