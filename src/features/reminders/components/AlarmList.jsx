import PropTypes from 'prop-types';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { AlarmItem } from './AlarmItem.jsx';

export function AlarmList({ alarms, onToggle, onRemove }) {
  if (alarms.length === 0) return <EmptyState>Belum ada alarm kustom.</EmptyState>;

  return (
    <ul className="mt-2">
      {alarms.map((alarm) => (
        <AlarmItem key={alarm.id} alarm={alarm} onToggle={onToggle} onRemove={onRemove} />
      ))}
    </ul>
  );
}

AlarmList.propTypes = {
  alarms: PropTypes.arrayOf(PropTypes.shape({
    days: PropTypes.arrayOf(PropTypes.number).isRequired,
    enabled: PropTypes.bool.isRequired,
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    label: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
  })).isRequired,
  onRemove: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
};
