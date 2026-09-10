/**
 * The presentation helpers, which are the only place the wire format becomes
 * something a Thai tenant reads.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { baht, period, shortDate, dateTime, nextPeriod } from '../src/lib/format.js';

test('money is satang on the wire and baht on the screen', () => {
  assert.equal(baht(525000), '5,250.00');
  assert.equal(baht(0), '0.00');
  // Satang are not decoration: a rent of 4,500.50 has to survive the trip.
  assert.equal(baht(450050), '4,500.50');
  assert.equal(baht(100), '1.00');
  // A missing amount reads as zero rather than as "NaN" on a bill.
  assert.equal(baht(null), '0.00');
  assert.equal(baht(undefined), '0.00');
});

test('years are Buddhist', () => {
  assert.equal(period('2026-09'), 'กันยายน 2569');
  assert.equal(period('2026-01'), 'มกราคม 2569');
  assert.equal(period('2026-12'), 'ธันวาคม 2569');
  assert.equal(shortDate('2026-09-05'), '5 ก.ย. 2569');
});

test('an unusable value renders as nothing, never as a broken date', () => {
  for (const value of ['', null, undefined, 'not-a-date', '2026', '2026-']) {
    assert.equal(period(value), '', `period(${JSON.stringify(value)})`);
    assert.equal(shortDate(value), '', `shortDate(${JSON.stringify(value)})`);
    assert.equal(dateTime(value), '', `dateTime(${JSON.stringify(value)})`);
    assert.equal(nextPeriod(value), '', `nextPeriod(${JSON.stringify(value)})`);
  }
});

test('a due date is a day, not an instant, and does not move', () => {
  // shortDate is given calendar dates. Converting one across a timezone would
  // put a bill due on the 1st onto the 31st.
  assert.equal(shortDate('2026-10-01'), '1 ต.ค. 2569');
  assert.equal(shortDate('2026-01-01'), '1 ม.ค. 2569');
});

test('a timestamp is read in Bangkok, not in UTC', () => {
  // The API stores and sends UTC. This used to slice the characters out of the
  // string and print them as they stood, so every time in the app was seven
  // hours early.
  assert.equal(dateTime('2026-09-01T10:09:58.000Z'), '1 ก.ย. 2569 17:09');

  // And late in the day it was a day early too: 17:09 UTC is past midnight in
  // Bangkok.
  assert.equal(dateTime('2026-09-01T17:09:58.000Z'), '2 ก.ย. 2569 00:09');
});

test('rows the pre-XYZ schema wrote are UTC too, and are read as UTC', () => {
  // SQLite's datetime('now') has no zone marker. Read as local time it would
  // be wrong by whatever the reader's phone is set to.
  assert.equal(dateTime('2026-09-01 10:09:58'), '1 ก.ย. 2569 17:09');
  assert.equal(dateTime('2026-09-01 17:09:58'), '2 ก.ย. 2569 00:09');
});

test('an explicit offset is honoured rather than overwritten', () => {
  assert.equal(dateTime('2026-09-01T17:09:58+07:00'), '1 ก.ย. 2569 17:09');
});

test('the period after December is January of the next year', () => {
  assert.equal(nextPeriod('2026-09'), 'ตุลาคม 2569');
  assert.equal(nextPeriod('2026-12'), 'มกราคม 2570');
  assert.equal(nextPeriod('2026-01'), 'กุมภาพันธ์ 2569');
});
