import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ user, onLogout, children }) {
    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <Sidebar user={user} />

            <div className="min-w-0 lg:pl-64">
                <Topbar user={user} onLogout={onLogout} />

                <main className="min-h-[calc(100vh-65px)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className="mx-auto w-full max-w-[1480px]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}