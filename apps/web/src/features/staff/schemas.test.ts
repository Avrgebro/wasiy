import { describe, expect, it } from 'vitest'
import { staffInviteSchema } from './schemas'

const identity = {
  email: 'staff@wasiy.test',
  first_name: 'Ana',
  last_name: 'Arriaga',
}

describe('staffInviteSchema', () => {
  it('accepts an admin invite even when a hidden empty assignment row remains', () => {
    const result = staffInviteSchema.safeParse({
      ...identity,
      access_type: 'account_admin',
      location_assignments: [{ location_id: '', role: 'location_manager' }],
    })

    expect(result.success).toBe(true)
  })

  it('requires a location on every row for location staff', () => {
    const result = staffInviteSchema.safeParse({
      ...identity,
      access_type: 'location_staff',
      location_assignments: [{ location_id: '', role: 'location_manager' }],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'validation.locationRequired',
        path: ['location_assignments', 0, 'location_id'],
      }),
    )
  })

  it('requires at least one assignment for location staff', () => {
    const result = staffInviteSchema.safeParse({
      ...identity,
      access_type: 'location_staff',
      location_assignments: [],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ message: 'validation.locationAssignmentsRequired' }),
    )
  })

  it('rejects the same location assigned twice', () => {
    const result = staffInviteSchema.safeParse({
      ...identity,
      access_type: 'location_staff',
      location_assignments: [
        { location_id: 'loc-1', role: 'location_manager' },
        { location_id: 'loc-1', role: 'front_desk' },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'validation.locationDuplicated',
        path: ['location_assignments', 1, 'location_id'],
      }),
    )
  })
})
