import { useId } from 'react';
import PropTypes from 'prop-types';
import { FIELD_CLASS, LABEL_CLASS } from './fieldStyles.js';

export function SelectField({ label, className = '', children, ...selectProps }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <select id={id} className={FIELD_CLASS} {...selectProps}>
        {children}
      </select>
    </div>
  );
}

SelectField.propTypes = {
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
  children: PropTypes.node,
};
