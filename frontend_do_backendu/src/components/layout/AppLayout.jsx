import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ user, onLogout, children }) {
    return (
        <div className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <Sidebar user={user} />

            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar user={user} onLogout={onLogout} />

                <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
                    {children}
                </main>
            </div>
        </div>
    );
}