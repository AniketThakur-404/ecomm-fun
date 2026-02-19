import React from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/admin-auth-context';

const AdminLayout = () => {
  const { admin, isAuthenticated, loading, logout } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm uppercase tracking-[0.35em] text-slate-400">Loading admin...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  const navItemClass = ({ isActive }) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin Console</p>
            <h1 className="text-2xl font-bold text-white mt-2">Aradhya Studio</h1>
          </div>

          <nav className="flex flex-col gap-2">
            <NavLink
              to="/admin"
              end
              className={navItemClass}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/admin/products"
              className={navItemClass}
            >
              Products
            </NavLink>
            <NavLink
              to="/admin/collections"
              className={navItemClass}
            >
              Collections
            </NavLink>
            <NavLink
              to="/admin/orders"
              className={navItemClass}
            >
              Orders
            </NavLink>
            <NavLink
              to="/admin/reviews"
              className={navItemClass}
            >
              Reviews
            </NavLink>
            <NavLink
              to="/admin/users"
              className={navItemClass}
            >
              Users
            </NavLink>
          </nav>

          <div className="mt-auto space-y-3">
            <div className="text-xs text-slate-400">
              Signed in as <span className="text-slate-200 font-semibold">{admin?.email}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-slate-950">
          <div className="border-b border-slate-800 px-8 py-5">
            <h2 className="text-lg font-semibold text-white">Commerce Control</h2>
            <p className="text-sm text-slate-400">Manage products, collections, users, reviews, and order tracking.</p>
          </div>
          <div className="p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
