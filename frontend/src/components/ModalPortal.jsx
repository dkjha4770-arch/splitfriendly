import { createPortal } from 'react-dom';

/**
 * ModalPortal — renders children directly into document.body via a React portal.
 * This escapes any ancestor CSS context (backdrop-filter, transform, overflow:hidden)
 * that would otherwise break `position: fixed` centering of modals.
 */
const ModalPortal = ({ children }) => {
  return createPortal(children, document.body);
};

export default ModalPortal;
