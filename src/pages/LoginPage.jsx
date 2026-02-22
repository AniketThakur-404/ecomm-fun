import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5">
        <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3.1l3 2.3c1.8-1.6 2.8-4.1 2.8-7 0-.7-.1-1.5-.2-2.2H12z"
        />
        <path
            fill="#34A853"
            d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3-2.3c-.8.5-1.9.9-3.3.9-2.5 0-4.6-1.7-5.3-4H3.7v2.4C5.3 19.8 8.4 22 12 22z"
        />
        <path
            fill="#4A90E2"
            d="M6.7 14.1c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V8.3H3.7A9.8 9.8 0 0 0 2.6 12c0 1.6.4 3.2 1.1 4.6l3-2.5z"
        />
        <path
            fill="#FBBC05"
            d="M12 6.5c1.4 0 2.6.5 3.5 1.4l2.6-2.6C16.8 4 14.6 3 12 3 8.4 3 5.3 5.2 3.7 8.3l3 2.4c.7-2.3 2.8-4.2 5.3-4.2z"
        />
    </svg>
);

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');

    const { login, loginWithGoogle, canUseGoogleAuth, loading, error } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const redirectPath = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const redirect = params.get('redirect');
        if (!redirect || !redirect.startsWith('/')) return '/profile';
        return redirect;
    }, [location.search]);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        const normalizedEmail = email.trim();

        if (!normalizedEmail || !password) {
            setLocalError('Please fill in all fields');
            return;
        }

        const result = await login(normalizedEmail, password);
        if (result.success) {
            navigate(redirectPath, { replace: true });
        }
    };

    const handleGoogleSignIn = useCallback(async () => {
        setLocalError('');
        const result = await loginWithGoogle();
        if (result.success) {
            navigate(redirectPath, { replace: true });
        } else if (result.error) {
            setLocalError(result.error);
        }
    }, [loginWithGoogle, navigate, redirectPath]);

    return (
        <div className="min-h-screen pt-32 pb-16 site-shell flex flex-col items-center">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold mb-2">Welcome Back</h1>
                    <p className="text-gray-600">Sign in to your account</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
                    {(localError || error) && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {localError || error}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading || !canUseGoogleAuth}
                        className="w-full border border-gray-300 bg-white text-gray-900 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <GoogleIcon />
                        <span>
                            {loading
                                ? 'Please wait...'
                                : canUseGoogleAuth
                                    ? 'Continue with Google'
                                    : 'Google sign-in unavailable'}
                        </span>
                    </button>

                    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-gray-400">
                        <span className="h-px flex-1 bg-gray-200" />
                        <span>or</span>
                        <span className="h-px flex-1 bg-gray-200" />
                    </div>

                    <form onSubmit={handlePasswordSubmit}>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black transition-colors"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-2">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black transition-colors"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-black text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? (
                                    <span>Signing in...</span>
                                ) : (
                                    <>
                                        <LogIn className="w-5 h-5" />
                                        <span>Sign In</span>
                                    </>
                                )}
                            </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-600">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-black font-bold hover:underline">
                            Create one
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
