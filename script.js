// Inicializar ícones Lucide
lucide.createIcons();

// Menu Mobile Toggle
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

menuBtn.addEventListener('click', () => {
  mobileMenu.classList.toggle('hidden');
});

// Fechar menu mobile ao clicar em um link
const mobileMenuLinks = mobileMenu.querySelectorAll('a');
mobileMenuLinks.forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
  });
});

// Smooth scroll para navegação
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// FAQ Accordion
const faqQuestions = document.querySelectorAll('.faq-question');

faqQuestions.forEach(question => {
  question.addEventListener('click', () => {
    const answer = question.nextElementSibling;
    const icon = question.querySelector('.faq-icon');
    const isExpanded = question.getAttribute('aria-expanded') === 'true';
    
    // Fechar todas as outras perguntas
    faqQuestions.forEach(otherQuestion => {
      if (otherQuestion !== question) {
        const otherAnswer = otherQuestion.nextElementSibling;
        const otherIcon = otherQuestion.querySelector('.faq-icon');
        otherQuestion.setAttribute('aria-expanded', 'false');
        otherAnswer.classList.add('hidden');
        otherIcon.style.transform = 'rotate(0deg)';
      }
    });
    
    // Toggle da pergunta atual
    if (isExpanded) {
      question.setAttribute('aria-expanded', 'false');
      answer.classList.add('hidden');
      icon.style.transform = 'rotate(0deg)';
    } else {
      question.setAttribute('aria-expanded', 'true');
      answer.classList.remove('hidden');
      icon.style.transform = 'rotate(180deg)';
    }
  });
});

// Form validation
const form = document.getElementById('registerForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');

const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');

// Função para validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Função para mostrar erro
function showError(errorElement, inputElement) {
  errorElement.classList.remove('hidden');
  inputElement.classList.add('border-red-500');
  inputElement.classList.remove('border-gray-300');
}

// Função para esconder erro
function hideError(errorElement, inputElement) {
  errorElement.classList.add('hidden');
  inputElement.classList.remove('border-red-500');
  inputElement.classList.add('border-gray-300');
}

// Validação em tempo real
nameInput.addEventListener('input', () => {
  if (nameInput.value.trim().length >= 3) {
    hideError(nameError, nameInput);
  }
});

emailInput.addEventListener('input', () => {
  if (isValidEmail(emailInput.value)) {
    hideError(emailError, emailInput);
  }
});

// Type select removed from current form design

// Submissão do formulário
form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  let isValid = true;
  
  // Validar nome
  if (nameInput.value.trim().length < 3) {
    showError(nameError, nameInput);
    isValid = false;
  } else {
    hideError(nameError, nameInput);
  }
  
  // Validar email
  if (!isValidEmail(emailInput.value)) {
    showError(emailError, emailInput);
    isValid = false;
  } else {
    hideError(emailError, emailInput);
  }
  
  // Type validation removed from current form design
  
  if (isValid) {
    // Simular envio do formulário
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.textContent = 'Cadastrando...';
    submitBtn.disabled = true;
    
    setTimeout(() => {
      alert(`Cadastro realizado com sucesso!\n\nNome: ${nameInput.value}\nEmail: ${emailInput.value}\nTipo: ${typeSelect.options[typeSelect.selectedIndex].text}`);
      
      // Reset do formulário
      form.reset();
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }, 2000);
  }
});

// Animações de entrada
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
    }
  });
}, observerOptions);

// Observar elementos com animação
document.querySelectorAll('.fade-in').forEach(el => {
  el.style.animationPlayState = 'paused';
  observer.observe(el);
});