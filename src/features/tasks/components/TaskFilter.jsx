import PropTypes from 'prop-types';
import { Button } from '../../../components/ui/Button.jsx';
import { TASK_FILTERS } from '../../../lib/tasks.js';

export function TaskFilter({ value, onChange }) {
  return (
    <fieldset className="mt-3 flex gap-2">
      <legend className="sr-only">Filter tugas</legend>
      {TASK_FILTERS.map((filter) => (
        <Button
          key={filter.value}
          size="sm"
          variant={filter.value === value ? 'primary' : 'ghost'}
          aria-pressed={filter.value === value}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
    </fieldset>
  );
}

TaskFilter.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
};
