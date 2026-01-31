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
            // Extract number and suffix (e.g. "20+" -> 20, "+")
            // Regex matches: digits, optional decimal, then optional suffix
            const match = rawText.match(/([\d\.]+)(.*)/);
            if (match) {
                const val = parseFloat(match[1]);
                const suffix = match[2];
                // Only animate if not already animated to avoid resets on slight scroll
                if (!el.classList.contains('animated')) {
                    animateValue(el, 0, val, 2000, suffix);
                    el.classList.add('animated');
                    // Special case for big numbers with nested span for plus
                    // If the structure is <span class="big-number">20<span class="plus">+</span></span>
                    // The innerText is "20+". We overwrite it. 
                    // To preserve styling of the plus sign if it was separate, we might need a more delicate approach.
                    // However, observing the HTML: <span class="big-number">20<span class="plus">+</span></span>
                    // `el.innerText` will be "20+". 
                    // Re-writing nested HTML might lose the class "plus".
                    // Better strategy: Only animate the *first text node* if possible, or reconstruct the HTML.

                    // Specific fix for "big-number" structure:
                    // If it has a child with class 'plus', we should keep it.
                    const plusSpan = el.querySelector('.plus');
                    if (plusSpan) {
                        // Animate just the text node part
                        // By standard, setting innerHTML wipes children.
                        // Let's modify `animateValue` to accept a callback or handle text node.
                        // SIMPLER: just animate the number and append the span back at the end? 
                        // No, we want smooth counting. 
                        // Let's target the text node directly? 
                        // Text node might be hard to select.

                        // Alternative: Re-create the HTML content string in the animation loop.
                        // Loop: obj.innerHTML = currentVal + '<span class="plus">' + suffix.replace('+','') + '</span>'; 
                        // Actually suffix from regex will be "+" from the child text.
                        // Let's hardcode the suffix span if we detect it.
                    }
                }
            }
            observer.unobserve(el);
        }
    });
});

// We need a more robust observer callback to handle the specific HTML structures found.
// Redefining the observer for clarity and correctness.
const numberObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            if (el.classList.contains('animated')) return;

            // Check for specific structures
            const plusSpan = el.querySelector('.plus');
            let endVal = 0;
            let suffix = '';
            let isFloat = false;

            if (plusSpan) {
                // Case: <span class="big-number">20<span class="plus">+</span></span>
                endVal = parseFloat(el.firstChild.textContent);
                suffix = '<span class="plus">+</span>'; // Re-inject the span structure
            } else {
                // Case: Simple text "85%" or "5.2M+"
                const rawText = el.innerText;
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
                    // Easing (easeOutQuad)
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

// 2. Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        if (this.classList.contains('modal-cta')) return;

        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId.startsWith('#') && targetId.length > 1) {
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        }
    });
});

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

// 4. MODAL LOGIC (Updated to switch images)
const modal = document.getElementById('analysis-modal');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.querySelector('.modal-media');

function openModal(client) {
    if (modal) {
        // Change content based on which button was clicked
        if (client === 'robert') {
            modalTitle.innerText = "Robert Herjavec";
            modalImage.src = "images/image05.png"; // Robert's Evidence
        } else if (client === 'davie') {
            modalTitle.innerText = "Davie Fogarty";
            modalImage.src = "images/image04.png"; // Davie's Evidence
        }

        // Show Modal
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('active');

            // Trigger animation for modal stats
            const stats = modal.querySelectorAll('.stat-num');
            stats.forEach(el => {
                el.classList.remove('animated'); // Reset

                const rawText = el.innerText; // "5.2M+" or "300%"
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
    });

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            hamburger.classList.remove("active");
            navMenu.classList.remove("active");
        });
    });
}