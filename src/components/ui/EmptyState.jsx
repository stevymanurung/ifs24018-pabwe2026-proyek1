import PropTypes from 'prop-types';

export function EmptyState({ children }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

EmptyState.propTypes = {
  children: PropTypes.node.isRequired,
};
