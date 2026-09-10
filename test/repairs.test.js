/**
 * Which tab a repair request lands in.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isOpenRepair } from '../src/pages/repairs.js';

test('a request the tenant just filed is open', () => {
  // The regression this exists for: `open` is the status every repair is
  // created with, and it used to be missing from the open tab's list, so a
  // request appeared under "ปิดแล้ว" the moment it was submitted.
  assert.equal(isOpenRepair('open'), true);
  assert.equal(isOpenRepair('in_progress'), true);
});

test('a finished or abandoned request is closed', () => {
  assert.equal(isOpenRepair('done'), false);
  assert.equal(isOpenRepair('cancelled'), false);
});

test('a status this build does not know is treated as open', () => {
  // A new stage of work added on the operator's side must not silently file
  // live requests under "closed".
  assert.equal(isOpenRepair('awaiting_parts'), true);
  assert.equal(isOpenRepair(''), true);
  assert.equal(isOpenRepair(null), true);
  assert.equal(isOpenRepair(undefined), true);
});

test('the vocabulary is matched whatever its case', () => {
  assert.equal(isOpenRepair('DONE'), false);
  assert.equal(isOpenRepair('Cancelled'), false);
  assert.equal(isOpenRepair('OPEN'), true);
});
