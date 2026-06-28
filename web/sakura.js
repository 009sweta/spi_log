(function() {
  const canvas = document.getElementById('sakura-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const TOTAL_PETALS = 55;
  const FOCAL_LENGTH = 350;
  const MAX_DEPTH = 600;

  class Petal {
    constructor() {
      this.reset(true);
    }

    reset(initiallyRandomY = false) {
      // 3D coordinates relative to center of screen
      this.x = (Math.random() - 0.5) * width * 1.8;
      this.y = initiallyRandomY ? (Math.random() - 0.5) * height * 1.8 : -height / 2 - 20;
      this.z = Math.random() * MAX_DEPTH;
      
      this.r = Math.random() * 8 + 6; // size radius
      
      // Velocities
      this.vy = Math.random() * 1.2 + 0.8; // falling speed
      this.vx = Math.random() * 1.0 - 0.3; // wind drift
      
      // 3D Rotations
      this.rx = Math.random() * Math.PI * 2;
      this.ry = Math.random() * Math.PI * 2;
      this.rz = Math.random() * Math.PI * 2;

      // Rotation speeds
      this.vrx = Math.random() * 0.02 + 0.01;
      this.vry = Math.random() * 0.02 + 0.01;
      this.vrz = Math.random() * 0.01 + 0.005;

      // Wind sway frequency
      this.swayOffset = Math.random() * Math.PI * 2;
      this.swaySpeed = Math.random() * 0.015 + 0.005;
    }

    update() {
      this.y += this.vy;
      this.x += this.vx + Math.sin(this.swayOffset) * 0.4;
      this.swayOffset += this.swaySpeed;

      this.rx += this.vrx;
      this.ry += this.vry;
      this.rz += this.vrz;

      // 3D Projection Calculation
      const scale = FOCAL_LENGTH / (FOCAL_LENGTH + this.z);
      const px = this.x * scale + width / 2;
      const py = this.y * scale + height / 2;

      // If out of bounds, reset to top
      const padding = this.r * scale * 2;
      if (py > height + padding || px < -padding || px > width + padding) {
        this.reset(false);
      }
    }

    draw() {
      const scale = FOCAL_LENGTH / (FOCAL_LENGTH + this.z);
      const px = this.x * scale + width / 2;
      const py = this.y * scale + height / 2;
      const size = this.r * scale;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(this.rz);
      
      // Simulate 3D rotation by scaling axes with cosines
      ctx.scale(Math.cos(this.rx), Math.sin(this.ry));

      // Draw Sakura petal shape
      ctx.beginPath();
      // Draw organic curved petal
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-size * 1.2, -size * 0.5, -size * 0.6, -size * 1.5);
      ctx.quadraticCurveTo(0, -size * 2, size * 0.6, -size * 1.5);
      ctx.quadraticCurveTo(size * 1.2, -size * 0.5, 0, 0);
      ctx.closePath();

      // Soft pink gradient for 3D depth lighting
      const grad = ctx.createLinearGradient(0, 0, 0, -size * 2);
      grad.addColorStop(0, '#FFB7C5');
      grad.addColorStop(0.6, '#FFA0B4');
      grad.addColorStop(1, '#FF8FA3');

      ctx.fillStyle = grad;
      
      // Subtle transparent outline to make petals stand out
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  const petals = Array.from({ length: TOTAL_PETALS }, () => new Petal());

  function loop() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < petals.length; i++) {
      petals[i].update();
      petals[i].draw();
    }

    requestAnimationFrame(loop);
  }

  loop();
})();
