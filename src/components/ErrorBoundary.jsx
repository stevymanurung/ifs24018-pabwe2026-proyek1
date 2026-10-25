import { Component } from 'react';
import PropTypes from 'prop-types';
import { ErrorBanner } from './ui/ErrorBanner.jsx';

/** Menangkap error saat render agar satu halaman yang rusak tidak mematikan seluruh aplikasi. */
export class ErrorBoundary extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
  };

  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Kesalahan render:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBanner message="Terjadi kesalahan saat menampilkan halaman ini. Muat ulang halaman untuk mencoba lagi." />;
    }
    return this.props.children;
  }
}
