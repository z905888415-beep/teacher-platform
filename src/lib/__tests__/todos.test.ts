import { describe, expect, it } from 'vitest'
import { groupTodos } from '../todos'
import type { Todo } from '../../db'

function todo(overrides: Partial<Todo>): Todo {
  return {
    title: 'x',
    category: '教学',
    priority: 'normal',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('groupTodos', () => {
  const today = '2026-08-31'

  it('拆分逾期、今天、本周；已完成和归档不进入', () => {
    const buckets = groupTodos(
      [
        todo({ title: '逾期', dueAt: '2026-08-29' }),
        todo({ title: '今天', dueAt: today }),
        todo({ title: '本周', dueAt: '2026-09-03' }),
        todo({ title: '更远', dueAt: '2026-09-20' }),
        todo({ title: '完成', dueAt: today, doneAt: today }),
        todo({ title: '归档', dueAt: today, archivedAt: today }),
      ],
      today,
    )
    expect(buckets.overdue.map((item) => item.title)).toEqual(['逾期'])
    expect(buckets.today.map((item) => item.title)).toEqual(['今天'])
    expect(buckets.week.map((item) => item.title)).toEqual(['本周'])
  })
})
