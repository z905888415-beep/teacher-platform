import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { Button, Panel } from '../components/ui'

/** 未知路由 / 已移除功能：旧书签统一落到这里，不进入工作台（F08） */
export function NotFound() {
  return (
    <Panel title="页面不存在或功能已移除" bodyClassName="p-6">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <SearchX size={36} className="text-ink-500" aria-hidden />
        <p className="text-sm text-ink-700">
          您访问的页面不存在，或属于已删除的旧版功能（如高考、学籍、选科等模块已不再提供）。
        </p>
        <Link to="/">
          <Button variant="primary">回到工作台</Button>
        </Link>
      </div>
    </Panel>
  )
}
