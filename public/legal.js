// Aplica o tema que a pessoa escolheu no app (guardado no navegador) às páginas públicas de Termos e Política.
try {
  const theme = localStorage.getItem('apostila-theme');
  if (theme) document.documentElement.dataset.theme = theme;
} catch { /* armazenamento bloqueado: fica o tema padrão */ }
