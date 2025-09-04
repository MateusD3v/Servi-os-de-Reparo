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
    const faqItem = question.parentElement;
    const icon = question.querySelector('.faq-icon');
    const isExpanded = question.getAttribute('aria-expanded') === 'true';
    
    // Fechar todas as outras perguntas
    faqQuestions.forEach(otherQuestion => {
      if (otherQuestion !== question) {
        const otherFaqItem = otherQuestion.parentElement;
        const otherIcon = otherQuestion.querySelector('.faq-icon');
        otherQuestion.setAttribute('aria-expanded', 'false');
        otherFaqItem.classList.remove('active');
        otherIcon.style.transform = 'rotate(0deg)';
      }
    });
    
    // Toggle da pergunta atual
    if (isExpanded) {
      question.setAttribute('aria-expanded', 'false');
      faqItem.classList.remove('active');
      icon.style.transform = 'rotate(0deg)';
    } else {
      question.setAttribute('aria-expanded', 'true');
      faqItem.classList.add('active');
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
if (form) {
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
      alert(`Cadastro realizado com sucesso!\n\nNome: ${nameInput.value}\nEmail: ${emailInput.value}`);
      
      // Reset do formulário
      form.reset();
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }, 2000);
  }
  });
}

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

// Back to Top Button Functionality
const backToTopBtn = document.getElementById('backToTop');

// Show/hide button based on scroll position
window.addEventListener('scroll', () => {
  if (window.pageYOffset > 300) {
    backToTopBtn.classList.add('show');
  } else {
    backToTopBtn.classList.remove('show');
  }
});

// Smooth scroll to top when button is clicked
backToTopBtn.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

// Plans Modal functionality
const plansModal = document.getElementById('plansModal');
const closePlansModal = document.getElementById('closePlansModal');
const modalOverlay = document.querySelector('.modal-overlay');
const planButtons = document.querySelectorAll('.plan-button');

// Function to open modal
function openPlansModal() {
  plansModal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Function to close modal
function closePlansModalFunc() {
  plansModal.classList.remove('active');
  document.body.style.overflow = 'auto'; // Restore scrolling
}

// Close modal when clicking the X button
closePlansModal.addEventListener('click', closePlansModalFunc);

// Close modal when clicking the overlay
modalOverlay.addEventListener('click', closePlansModalFunc);

// Close modal when pressing Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && plansModal.classList.contains('active')) {
    closePlansModalFunc();
  }
});

// Handle plan selection
planButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    const planType = e.target.classList.contains('plan-button-monthly') ? 'Mensal' :
                    e.target.classList.contains('plan-button-quarterly') ? 'Trimestral' : 'Anual';
    
    // You can customize this action - for now, we'll show an alert
    alert(`Você selecionou o Plano ${planType}! Em breve você será redirecionado para o pagamento.`);
    
    // Close modal after selection
    closePlansModalFunc();
    
    // Here you could redirect to a payment page or open another modal
    // window.location.href = `/checkout?plan=${planType.toLowerCase()}`;
  });
});

// Make openPlansModal function globally available
window.openPlansModal = openPlansModal;