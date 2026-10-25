import PropTypes from 'prop-types';

export function LoadingState({ label = 'Memuat data...' }) {
  return (
    <output aria-live="polite" className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" aria-hidden="true" />
      {label}
    </output>
  );
}

LoadingState.propTypes = {
  label: PropTypes.string,
};
