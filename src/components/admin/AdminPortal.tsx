import { useEffect, useState } from 'react';

const netlifyIdentity = window.netlifyIdentity!;

export default function AdminPortal() {
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<unknown>(null);

  useEffect(() => {
    netlifyIdentity.on('init', (u: unknown) => {
      setUser(u);
      setInitialized(true);
    });
    netlifyIdentity.on('login', (u: unknown) => {
      setUser(u);
      netlifyIdentity.close();
    });
    netlifyIdentity.on('logout', () => setUser(null));
    netlifyIdentity.init({ APIUrl: 'https://lowernotleyhallfarm.netlify.app/.netlify/identity' });
  }, []);

  if (!initialized) {
    return <div className="admin-login"><p>Loading...</p></div>;
  }

  if (!user) {
    return (
      <div className="admin-login">
        <h2>Booking Manager Login</h2>
        <p>Log in with Netlify Identity to access Tours and Weddings management.</p>
        <button className="btn btn--primary" onClick={() => netlifyIdentity.open('login')}>
          Log In
        </button>
      </div>
    );
  }

  return (
    <div className="admin-manager">
      <div className="admin-manager__topbar">
        <div>
          <h1 className="admin-manager__title">Booking Manager</h1>
          <p className="admin-manager__subtitle">Choose which booking type you want to manage.</p>
        </div>
        <button className="btn btn--secondary btn--sm" onClick={() => netlifyIdentity.logout()}>
          Log Out
        </button>
      </div>

      <section className="admin-manager__section">
        <div className="admin-manager__links">
          <article className="admin-manager__link-card">
            <h3>Tours Management</h3>
            <p>Manage tour slots, guest bookings, status updates, and exports.</p>
            <a href="/booking-manager/tours/" className="btn btn--primary">Open Tours Manager</a>
          </article>

          <article className="admin-manager__link-card">
            <h3>Weddings Management</h3>
            <p>Create and update weddings, activities, pricing line-items, and printable summaries.</p>
            <a href="/booking-manager/weddings/" className="btn btn--primary">Open Weddings Manager</a>
          </article>
        </div>
      </section>
    </div>
  );
}
