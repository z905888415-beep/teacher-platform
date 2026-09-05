import { addDays } from './dates'
import type { Todo } from '../db'

export interface TodoBuckets {
  overdue: Todo[]
  today: Todo[]
  week: Todo[]
}

/** 待办逾期 / 今天 / 本周分组（已完成、已归档不进入） */
export function groupTodos(todos: Todo[], today: string): TodoBuckets {
  const weekEnd = addDays(today, 7)
  const active = todos.filter((todo) => !todo.doneAt && !todo.archivedAt)
  return {
    overdue: active.filter((todo) => Boolean(todo.dueAt && todo.dueAt < today)),
    today: active.filter((todo) => todo.dueAt === today),
    week: active.filter((todo) => Boolean(todo.dueAt && todo.dueAt > today && todo.dueAt <= weekEnd)),
  }
}
