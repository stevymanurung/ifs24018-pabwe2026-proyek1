import PropTypes from 'prop-types';

export function Card({ title, className = '', children }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>}
      {children}
    </section>
  );
}

Card.propTypes = {
  title: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};
