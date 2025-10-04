document.addEventListener("DOMContentLoaded", () => {
  const steps = document.querySelectorAll(".step");
  let currentStep = 0;

  const showStep = (index) => {
    steps.forEach(step => step.classList.remove("active"));
    steps[index].classList.add("active");
  };

  document.querySelectorAll(".next-btn").forEach((btn, index) => {
    btn.addEventListener("click", () => {
      showStep(index + 1);
    });
  });

  document.querySelector(".restart-btn").addEventListener("click", () => {
    showStep(0);
  });

  showStep(0);
});