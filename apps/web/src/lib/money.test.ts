import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

const plain = (value: string) => value.replace(/\u202f/g, ' ')

describe('formatMoney', () => {
  it('drops the decimals when the cents are zero', () => {
    expect(plain(formatMoney(125000))).toBe('S/ 1 250')
    expect(plain(formatMoney(0))).toBe('S/ 0')
  })

  it('keeps two decimals otherwise', () => {
    expect(plain(formatMoney(125050))).toBe('S/ 1 250.50')
    expect(plain(formatMoney(5))).toBe('S/ 0.05')
  })

  it('renders outflows and negative balances with a real minus sign', () => {
    expect(plain(formatMoney(-60000))).toBe('− S/ 600')
    expect(plain(formatMoney(60000, { negative: true }))).toBe('− S/ 600')
  })
})
