// 1. Reveal Animation
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('show');
        }
    });
});

const hiddenElements = document.querySelectorAll('section, .bento-card, .project-card, .faq-item, .about-card');
hiddenElements.forEach((el) => {
    el.classList.add('hidden');
    observer.observe(el);
});

// 1.5 Number Animation
const animateValue = (obj, start, end, duration, suffix = '') => {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Handle float vs int
        const isFloat = end % 1 !== 0;
        const currentVal = progress * (end - start) + start;
        const formattedVal = isFloat ? currentVal.toFixed(1) : Math.floor(currentVal);

        obj.innerHTML = formattedVal + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
};

const numObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const rawText = el.innerText;
            const match = rawText.match(/([\d\.]+)(.*)/);
            if (match) {
                const val = parseFloat(match[1]);
                const suffix = match[2];
                if (!el.classList.contains('animated')) {
                    animateValue(el, 0, val, 2000, suffix);
                    el.classList.add('animated');

                    const plusSpan = el.querySelector('.plus');
                    if (plusSpan) {

                    }
                }
            }
            observer.unobserve(el);
        }
    });
});

const numberObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            if (el.classList.contains('animated')) return;

            const plusSpan = el.querySelector('.plus');
            let endVal = 0;
            let suffix = '';
            let isFloat = false;

            if (plusSpan) {
                const textContent = el.firstChild ? el.firstChild.textContent : '';
                endVal = parseFloat(textContent) || 0;
                suffix = '<span class="plus">+</span>';
            } else {
                const rawText = el.innerText || '';
                const match = rawText.match(/([\d\.]+)(.*)/);
                if (match) {
                    endVal = parseFloat(match[1]);
                    suffix = match[2];
                    isFloat = rawText.includes('.');
                }
            }

            if (endVal > 0) {
                let startTimestamp = null;
                const duration = 2000;
                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    const easeProgress = 1 - (1 - progress) * (1 - progress);

                    const currentVal = easeProgress * endVal;
                    const formattedVal = isFloat ? currentVal.toFixed(1) : Math.floor(currentVal);

                    el.innerHTML = formattedVal + suffix;

                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    } else {
                        el.classList.add('animated');
                    }
                };
                window.requestAnimationFrame(step);
            }
            observer.unobserve(el);
        }
    });
});

document.querySelectorAll('.big-number, .animate-num').forEach(el => numberObserver.observe(el));

// 2. Smooth Scroll (Enhanced)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const isModalCta = this.classList.contains('modal-cta');

        e.preventDefault();
        const targetId = this.getAttribute('href');

        if (isModalCta) {
            closeModal();
            setTimeout(() => {
                scrollToTarget(targetId);
            }, 300);
            return;
        }

        scrollToTarget(targetId);
    });
});

function scrollToTarget(targetId) {
    if (targetId.startsWith('#') && targetId.length > 1) {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const headerOffset = 60;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
    }
}

// 3. FAQ Logic
const faqQuestions = document.querySelectorAll('.faq-question');
faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const item = question.parentNode;
        const answer = item.querySelector('.faq-answer');
        item.classList.toggle('active');

        if (item.classList.contains('active')) {
            answer.style.maxHeight = answer.scrollHeight + "px";
        } else {
            answer.style.maxHeight = 0;
        }

        faqQuestions.forEach(otherQuestion => {
            const otherItem = otherQuestion.parentNode;
            if (otherItem !== item && otherItem.classList.contains('active')) {
                otherItem.classList.remove('active');
                otherItem.querySelector('.faq-answer').style.maxHeight = 0;
            }
        });
    });
});

// 4. MODAL LOGIC 
const modal = document.getElementById('analysis-modal');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.querySelector('.modal-media');

function openModal(client) {
    if (modal) {
        if (client === 'robert') {
            modalTitle.innerText = "Robert Herjavec";
            modalImage.src = "images/image05.png";
        } else if (client === 'davie') {
            modalTitle.innerText = "Davie Fogarty";
            modalImage.src = "images/image04.png";
        }

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('active');

            const stats = modal.querySelectorAll('.stat-num');
            stats.forEach(el => {
                el.classList.remove('animated');

                const rawText = el.innerText;
                const match = rawText.match(/([\d\.]+)(.*)/);
                if (match) {
                    const endVal = parseFloat(match[1]);
                    const suffix = match[2];
                    const isFloat = rawText.includes('.');

                    let startTimestamp = null;
                    const duration = 1500;
                    const step = (timestamp) => {
                        if (!startTimestamp) startTimestamp = timestamp;
                        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                        const easeProgress = 1 - (1 - progress) * (1 - progress);

                        const currentVal = easeProgress * endVal;
                        const formattedVal = isFloat ? currentVal.toFixed(1) : Math.floor(currentVal);

                        el.innerHTML = formattedVal + suffix;
                        if (progress < 1) window.requestAnimationFrame(step);
                    };
                    window.requestAnimationFrame(step);
                }
            });

        }, 10);
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 400);
        document.body.style.overflow = 'auto';
    }
}

if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
        closeModal();
    }
});

// 5. Hamburger Menu
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-links");
const navLinks = document.querySelectorAll(".nav-links li");

if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("active");
        navMenu.classList.toggle("active");

        if (navMenu.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    });

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            hamburger.classList.remove("active");
            navMenu.classList.remove("active");
            document.body.style.overflow = 'auto';
        });
    });
}
