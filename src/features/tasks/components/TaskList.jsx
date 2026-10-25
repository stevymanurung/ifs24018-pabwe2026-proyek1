import PropTypes from 'prop-types';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { isOverdue } from '../../../lib/tasks.js';
import { TaskItem } from './TaskItem.jsx';

export function TaskList({ tasks, now, onToggle, onRemove }) {
  if (tasks.length === 0) return <EmptyState>Belum ada tugas di sini.</EmptyState>;

  return (
    <ul className="mt-3">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} overdue={isOverdue(task, now)} onToggle={onToggle} onRemove={onRemove} />
      ))}
    </ul>
  );
}

TaskList.propTypes = {
  now: PropTypes.instanceOf(Date).isRequired,
  onRemove: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  tasks: PropTypes.arrayOf(PropTypes.shape({
    course: PropTypes.string,
    done: PropTypes.bool.isRequired,
    dueDate: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    remindAt: PropTypes.string,
    title: PropTypes.string.isRequired,
  })).isRequired,
};
