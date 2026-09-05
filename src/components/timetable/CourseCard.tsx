import { useDraggable } from '@dnd-kit/core'
import { courseColors } from '../../lib/courseColors'
import type { WeekCourse } from '../../lib/timetable'

interface CourseCardProps {
  course: WeekCourse
  onOpen: (course: WeekCourse) => void
  onMoveRequest: (course: WeekCourse) => void
  dragging?: boolean
}

/** 拖动时跟随指针的课程内容预览；不包含交互与拖动 hook。 */
export function CourseDragPreview({ course }: { course: WeekCourse }) {
  const [color, soft] = courseColors(course.subject)
  return (
    <div
      aria-hidden
      className="w-36 rotate-1 rounded-menu px-3 py-2 shadow-panel ring-1 ring-black/5"
      style={{ background: soft, borderLeft: `3px solid ${color}` }}
    >
      <span className="block truncate text-xs font-bold leading-[18px] text-ink-900">{course.subject}</span>
      <span className="mt-0.5 block truncate text-[10px] leading-[14px] text-ink-500">
        {course.className}{course.room ? ` · ${course.room}` : ''}
      </span>
    </div>
  )
}

/** 课程卡：浅底色 + 左侧课程主色线；拖动中透明度 88%（UI 规范 6.3） */
export function CourseCard({ course, onOpen, onMoveRequest, dragging }: CourseCardProps) {
  const [color, soft] = courseColors(course.subject)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `course-${course.templateId}`,
    data: { course },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`课程：${course.subject}，${course.className}${course.room ? `，教室 ${course.room}` : ''}。单击编辑，双击进入移动模式`}
      onClick={() => onOpen(course)}
      onDoubleClick={() => onMoveRequest(course)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpen(course)
        } else if (event.key === 'm' || event.key === 'M') {
          event.preventDefault()
          onMoveRequest(course)
        }
      }}
      className={`group relative cursor-grab select-none rounded-menu px-2 py-1.5 transition-shadow duration-100 hover:-translate-y-px hover:shadow-panel active:cursor-grabbing ${
        course.isCurrent ? 'ring-2 ring-brand-600' : ''
      } ${dragging || isDragging ? 'opacity-[0.88]' : ''}`}
      style={{ background: soft, borderLeft: `3px solid ${color}` }}
    >
      <span className="block truncate text-xs font-bold leading-[18px] text-ink-900">{course.subject}</span>
      <span className="mt-0.5 block truncate text-[10px] leading-[14px] text-ink-500">
        {course.className}
        {course.room ? ` · ${course.room}` : ''}
      </span>
      {course.tags.length > 0 && (
        <span className="mt-1 flex flex-wrap gap-1">
          {course.tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex h-[18px] items-center rounded-full border px-1.5 text-[9px] font-bold leading-none ${
                tag === '仅本周'
                  ? 'border-brand-600/50 bg-white text-brand-600'
                  : 'border-line-strong/60 bg-white/70 text-ink-500'
              }`}
            >
              {tag}
            </span>
          ))}
        </span>
      )}
      <button
        type="button"
        aria-label={`移动课程：${course.subject}`}
        title="移动课程（M）"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onMoveRequest(course)
        }}
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-500 opacity-0 shadow-panel transition-opacity focus-visible:opacity-100 focus-visible:text-brand-600 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-brand-600"
      >
        <span aria-hidden className="text-[10px] font-bold">
          移
        </span>
      </button>
    </div>
  )
}
