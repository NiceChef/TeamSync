import { Clock3, LogOut, ShieldCheck } from 'lucide-react';

export default function PendingApproval({ user, onLogout }) {
    const isRejected = user?.approval_status === 'rejected';

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    {isRejected ? (
                        <ShieldCheck className="h-7 w-7" />
                    ) : (
                        <Clock3 className="h-7 w-7" />
                    )}
                </div>

                <h1 className="mt-5 text-2xl font-bold text-slate-900">
                    {isRejected ? 'Konto nie zostało zatwierdzone' : 'Czekasz na autoryzację'}
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                    {isRejected
                        ? 'Twoje konto zostało odrzucone przez administratora TeamSync. Skontaktuj się z osobą odpowiedzialną za dostęp.'
                        : 'Twoje konto zostało utworzone, ale musi zostać zatwierdzone przez użytkownika TeamSync. Po zatwierdzeniu uzyskasz dostęp do aplikacji.'}
                </p>

                {user && (
                    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700">
                        <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Użytkownik</span>
                            <span className="font-medium">{user.username}</span>
                        </div>
                        <div className="mt-2 flex justify-between gap-3">
                            <span className="text-slate-500">E-mail</span>
                            <span className="font-medium">{user.email}</span>
                        </div>
                        <div className="mt-2 flex justify-between gap-3">
                            <span className="text-slate-500">Status</span>
                            <span className="font-medium">{user.approval_status}</span>
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={onLogout}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    <LogOut className="h-4 w-4" />
                    Wyloguj
                </button>
            </div>
        </div>
    );
}