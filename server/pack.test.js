import test from 'node:test'
import assert from 'node:assert/strict'
import { detectPackSize, relevance } from './pack.js'
import { validHost } from './sources.js'

test('detects pack sizes from common title styles', () => {
  assert.equal(detectPackSize('10K Ohm Resistor (Pack of 100)'), 100)
  assert.equal(detectPackSize('M3 Hex Nut - 50 Pcs'), 50)
  assert.equal(detectPackSize('Jumper Wires Set of 40'), 40)
  assert.equal(detectPackSize('ESP32 DevKit V1 Development Board'), 1)
  assert.equal(detectPackSize('M3 x 20mm Hex Socket Bolt'), 1)
})

test('relevance ignores hyphens and spacing', () => {
  assert.equal(relevance('ESP32', 'ESP-32 Dev Board'), 1)
  assert.equal(relevance('10k resistor', '10K Ohm 1/4W Carbon Film Resistor'), 1)
  assert.equal(relevance('M3 bolt 20mm', 'M3 x 20mm Hex Socket Bolt'), 1)
  assert.ok(relevance('5V relay module', 'Arduino Uno R3') < 0.5)
})

test('custom shop hosts reject private or malformed names', () => {
  assert.equal(validHost('Example.com'), 'example.com')
  assert.equal(validHost('localhost'), null)
  assert.equal(validHost('127.0.0.1'), null)
  assert.equal(validHost('printer.local'), null)
  assert.equal(validHost('not a host'), null)
})
