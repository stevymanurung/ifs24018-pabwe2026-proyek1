import PropTypes from 'prop-types';
import { describeNextSession } from '../../lib/time.js';

/** Widget "Kuliah berikutnya" di dasar sidebar. */
export function NextClassCard({ next }) {
  const { course, when } = describeNextSession(next);
  return (
    <div className="m-3 rounded-xl bg-slate-800 p-4">
      <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Kuliah berikutnya</p>
      <p className="mt-1 text-sm font-semibold text-white">{course}</p>
      <p className="text-xs text-slate-400">{when}</p>
    </div>
  );
}

NextClassCard.propTypes = {
  next: PropTypes.shape({
    session: PropTypes.shape({
      course: PropTypes.string.isRequired,
      day: PropTypes.number.isRequired,
      end: PropTypes.string.isRequired,
      room: PropTypes.string,
      start: PropTypes.string.isRequired,
    }).isRequired,
    daysAhead: PropTypes.number.isRequired,
  }),
};
