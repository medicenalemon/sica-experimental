import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Simulamos una validación y delay
    setTimeout(() => {
      if (username === 'admin' && password === 'admin123') {
        localStorage.setItem('sica_isAuthenticated', 'true');
        navigate('/');
      } else {
        setError('Credenciales incorrectas. (Pista: admin / admin123)');
        setIsLoading(false);
      }
    }, 1500);
  };

  return (
    <div className="login-page animate-fade-in">
      <div className="login-header">
        <h2>Bienvenido de nuevo</h2>
        <p>Ingresa tus credenciales para acceder a tu cuenta.</p>
      </div>

      {error && (
        <div className="auth-alert-error animate-scale-in">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="login-form">
        <div className="form-group">
          <label htmlFor="username">Usuario</label>
          <div className="input-wrapper">
            <div className="input-icon">
              <User size={18} />
            </div>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: admin"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="form-group">
          <div className="label-row">
            <label htmlFor="password">Contraseña</label>
            <a href="#" className="forgot-password-link">¿Olvidaste tu contraseña?</a>
          </div>
          <div className="input-wrapper">
            <div className="input-icon">
              <Lock size={18} />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="form-options">
          <label className="checkbox-container">
            <input type="checkbox" disabled={isLoading} />
            <span className="checkmark"></span>
            Mantener sesión iniciada
          </label>
        </div>

        <button 
          type="submit" 
          className="btn-auth-submit" 
          disabled={isLoading || !username || !password}
        >
          {isLoading ? (
            <span className="loader-spinner"></span>
          ) : (
            <>
              Ingresar al Sistema
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="login-footer">
        <p>¿No tienes una cuenta? <a href="#">Solicita acceso al administrador</a>.</p>
      </div>
    </div>
  );
}
