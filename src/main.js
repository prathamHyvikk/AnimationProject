import * as THREE from "three";
import confetti from "canvas-confetti";
import { gsap } from "gsap";

const config = {
  colors: [0xffa500, 0x4169e1, 0xff6347, 0x32cd32, 0x00ced1],
  boxCount: 50,
  spread: 4,
};
let scene, camera, renderer, raycaster, mouse;
let boxes = [];
let particles = [];
let isHovering = false;
let selectedBox = null;
let gameState = "FORM";
let time = 0;

const uiForm = document.getElementById("stage-form");
const uiPick = document.getElementById("stage-pick");
const uiResult = document.getElementById("stage-result");
const formEl = document.getElementById("details-form");

function init() {
  scene = new THREE.Scene();

  scene.fog = new THREE.Fog(0xe0f2fe, 10, 50);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 15;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // const backLight = new THREE.PointLight(0xffd700, 0.5);
  // backLight.position.set(-5, -5, -5);
  // scene.add(backLight);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  createBackgroundMeshes();

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("click", onMouseClick);

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    transitionToPickPhase();
  });
}

function createBackgroundMeshes() {
  const geometry = new THREE.IcosahedronGeometry(3, 0);
  const logoTexture = new THREE.TextureLoader().load("/logo.svg");

  function createFloatingMesh(materialColor, position, speed = 0.006) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: materialColor,
        flatShading: true,
      })
    );

    mesh.position.set(position.x, position.y, position.z);
    mesh.userData.basePosition = mesh.position.clone();

    mesh.floatData = {
      offset: Math.random() * 100,
      baseScale: 1,
      rangeX: 6 + Math.random() * 4,
      rangeY: 4 + Math.random() * 3,
      rangeZ: 3 + Math.random() * 2,
    };

    function addLogo(x, y, z) {
      const logoGeo = new THREE.PlaneGeometry(1, 1);
      const logoMat = new THREE.MeshBasicMaterial({
        map: logoTexture,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const logoMesh = new THREE.Mesh(logoGeo, logoMat);
      logoMesh.position.set(x, y, z);
      logoMesh.lookAt(0, 0, 0);

      mesh.add(logoMesh);
    }

    addLogo(1, 0, 2.2);
    addLogo(-1.5, 1.4, 1.4);
    addLogo(2.2, 1, 0);
    addLogo(1.7, -1.3, -1.32);
    addLogo(-1.7, 1.5, -1.2);
    scene.add(mesh);
    boxes.push({ mesh, type: "bg", speed });

    return mesh;
  }

  createFloatingMesh("#4C6EF5", { x: -15, y: -6, z: -5 });

  // createFloatingMesh("#9B5DE5", { x: 14, y: 7, z: -8 });
  createFloatingMesh("#A8E063", { x: -17, y: 7, z: -8 });
  createFloatingMesh("#FF8FA3", { x: 11, y: 7, z: -8 });
  createFloatingMesh("#FFD166", { x: 10, y: -5, z: -6 });
  if (window.innerWidth < 800) {
    createFloatingMesh("#8E8AFF", { x: -1, y: -4, z: -5 });
    createFloatingMesh("#2EC4B6", { x: 0, y: 5, z: -8 });
  }

  // createFloatingMesh("#76E4F7", { x: 10, y: 0, z: -5 });
}

function createGameBoxes() {
  boxes.forEach((item) => {
    gsap.to(item.mesh.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.5,
      onComplete: () => scene.remove(item.mesh),
    });

    item.mesh.userData.basePosition = item.mesh.position.clone();
  });
  boxes = [];

  const geometry = new THREE.IcosahedronGeometry(1.7, 0);
  const logoTexture = new THREE.TextureLoader().load("/logo.svg");

  for (let i = 0; i < config.boxCount; i++) {
    const color = config.colors[i % config.colors.length];
    const material = new THREE.MeshStandardMaterial({
      color: color,

      emissive: color,
      emissiveIntensity: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);

    function addLogo(x, y, z) {
      const logoGeo = new THREE.PlaneGeometry(0.5, 0.5);
      const logoMat = new THREE.MeshBasicMaterial({
        map: logoTexture,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const logoMesh = new THREE.Mesh(logoGeo, logoMat);
      logoMesh.position.set(x, y, z);
      logoMesh.lookAt(mesh.position.clone().multiplyScalar(2));

      mesh.add(logoMesh);
    }
    // addLogo(0.5, 0, 1.3);
    // addLogo(-0.4, -0.2, 1.34);
    // addLogo(0.85, -0.8, 0.8);
    // addLogo(1, 0.68, 0.7);
    // addLogo(-0.4, -0, -1.37);
    // addLogo(-0.44, -1.36, -0.37);
    // addLogo(-1.27, 0.6, 0.33);
    addLogo(-0.99, 0.62, -0.8);
    addLogo(0.78, -0.8, 0.8);
    addLogo(-0.61, -0.8, 1);

    const xPos = (i - 2) * 5;

    mesh.position.set(xPos, 0, 0);

    mesh.userData.basePosition = mesh.position.clone();
    mesh.userData.id = i;
    mesh.userData.originalColor = color;

    scene.add(mesh);

    boxes.push({
      mesh: mesh,
      type: "game",
      floatOffset: Math.random() * 100,
      floatSpeed: 1 + Math.random(),
      rotSpeed: {
        x: Math.random() * 0.02,
        y: Math.random() * 0.02,
        z: Math.random() * 0.02,
      },
    });
  }
}

async function fetchVoucher() {
  try {
    const response = await fetch("../src/data.json");
    const data = await response.json();
    console.log(data.voucher);
    document.getElementById("coupon-code").innerText = data.voucher;
  } catch (error) {
    console.error(error);
  }
}

// Game Logic

function transitionToPickPhase() {
  gameState = "PICK";

  uiForm.classList.add("fade-out");

  setTimeout(() => {
    uiForm.style.display = "none";

    uiPick.classList.remove("hidden-vis");
    uiPick.classList.add("visible-vis");

    createGameBoxes();
  }, 500);
}

function handleBoxClick(intersectedMesh) {
  if (gameState !== "PICK") return;
  gameState = "REVEALING";
  selectedBox = intersectedMesh;
  fetchVoucher();

  uiPick.classList.remove("visible-vis");
  uiPick.classList.add("hidden-vis");

  boxes.forEach((item) => {
    if (item.mesh !== selectedBox) {
      gsap.to(item.mesh.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.5,
        ease: "back.in(1)",
      });
      gsap.to(item.mesh.position, {
        y: item.mesh.position.y - 2,
        duration: 0.5,
      });
    }
  });

  gsap.to(selectedBox.position, {
    x: 0,
    y: 0,
    z: 5,
    duration: 1,
    ease: "power2.inOut",
  });
  gsap.to(selectedBox.rotation, {
    x: 0,
    y: 0,
    z: 0,
    repeat: 20,
    duration: 0.05,
  });

  //  SHAKE Animation
  const tl = gsap.timeline({
    onComplete: explodeBox,
  });

  tl.to(selectedBox.position, { duration: 1 }, "+=0")
    .to(selectedBox.position, {
      x: "+=0.2",
      y: "+=0.2",
      yoyo: true,
      repeat: 30,
      duration: 0.05,
    })
    .to(
      selectedBox.scale,
      {
        x: 1.4,
        y: 1.4,
        z: 1.4,
        duration: 0.5,
        ease: "power1.in",
      },
      "<"
    )
    .to(
      selectedBox.material,
      {
        emissiveIntensity: 1,
        duration: 0.5,
      },
      "<"
    )
    .to(
      selectedBox.material,
      {
        emissiveIntensity: 2,
        duration: 1,
      },
      "<"
    );
}

function explodeBox() {
  selectedBox.visible = false;

  triggerConfetti();

  // function addMesh(position) {
  //   const geometry = new THREE.IcosahedronGeometry(1.3, 0);
  //   const material = new THREE.MeshStandardMaterial({
  //     color: "#2776f2",
  //   });

  //   const mesh = new THREE.Mesh(geometry, material);
  //   mesh.type = "bg";

  //   mesh.position.set(position.x, position.y, position.z);
  //   scene.add(mesh);

  //   gsap.to(mesh.rotation, {
  //     x: Math.PI * 2,
  //     y: Math.PI * 2,
  //     duration: 3,
  //     repeat: -1,
  //     ease: "none",
  //   });
  // }

  // addMesh({ x: -11, y: 4, z: 1 });
  // addMesh({ x: -8, y: -5, z: 0 });
  // addMesh({ x: 12, y: 4, z: 1.5 });
  // addMesh({ x: 8, y: -3, z: 0 });

  setTimeout(() => {
    uiResult.classList.remove("hidden-vis");
    uiResult.classList.add("visible-vis");

    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    // document.getElementById("coupon-code").innerText = `XXXX`;
  }, 200);
}

function triggerConfetti() {
  var duration = 60 * 1000;
  var animationEnd = Date.now() + duration;
  var defaults = {
    scalar: 2,
    startVelocity: 30,
    spread: 360,
    ticks: 200,
    zIndex: 0,
  };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  var interval = setInterval(function () {
    var timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    var particleCount = 50 * (timeLeft / duration);
    // since particles fall down, start a bit higher than random
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (gameState === "PICK") {
    checkIntersection();
  }
}

function onMouseClick(event) {
  if (gameState !== "PICK") return;

  if (gameState === "PICK" && isHovering) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    const box = intersects.find(
      (hit) => hit.object.geometry.type === "IcosahedronGeometry"
    );
    if (box) {
      handleBoxClick(box.object);
    }
  }
}

function checkIntersection() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);
  // selectedBox.userData.isSelected = true;

  const hit = intersects.find(
    (i) => i.object.geometry.type === "IcosahedronGeometry"
  );

  if (hit) {
    document.body.style.cursor = "pointer";
    isHovering = true;

    if (!hit.object.userData.isHovered) {
      gsap.to(hit.object.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.3 });
      hit.object.userData.isHovered = true;
    }
  } else {
    document.body.style.cursor = "default";
    isHovering = false;

    boxes.forEach((b) => {
      if (b.type === "game" && b.mesh.userData.isHovered) {
        gsap.to(b.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
        b.mesh.userData.isHovered = false;
      }
    });
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.render(scene, camera);
  onWindowResize();

  time += 0.01;

  const t = performance.now() * 0.001;

  boxes.forEach((box) => {
    const mesh = box.mesh;
    if (mesh === selectedBox) return;

    if (box.type === "bg") {
      const m = box.mesh;
      const b = m.userData.basePosition;
      const f = m.floatData;
      const off = f.offset;

      m.position.x =
        b.x + Math.sin(time * 0.25 + off * 0.2) * 4 + Math.sin(time * 0.1) * 8;

      m.position.y =
        b.y +
        Math.cos(time * 0.5 + off * 0.3) * 1 +
        Math.sin(time * 0.15) * 0.2;

      m.position.z = b.z + Math.sin(time * 0.22 + off * 0.2) * 2;

      const s = f.baseScale + Math.sin(time * 1.2 + off) * 0.12;
      m.scale.set(s, s, s);

      m.rotation.x += box.speed;
      m.rotation.y += box.speed * 1.1;
    }

    if (box.type === "game") {
      const m = box.mesh;
      const b = m.userData.basePosition;
      const off = box.floatOffset;

      m.position.x =
        b.x + Math.sin(time * 0.8 + off * 0.2) * 4 + Math.sin(time * 0.1) * 2;

      m.position.y =
        b.y + Math.cos(time * 0.5 + off * 0.3) * 4 + Math.sin(time * 0.15) * 2;

      m.position.z = b.z + Math.sin(time * 0.22 + off * 0.2) * 6;

      const rotMultiplier = m.userData.isSelected ? 0.03 : 0.3;

      m.rotation.x += box.rotSpeed.x * rotMultiplier;
      m.rotation.y += box.rotSpeed.y * rotMultiplier;
      m.rotation.z += box.rotSpeed.z * rotMultiplier;
    }
  });

  if (particles.length > 0) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.position.add(p.userData.velocity);
      p.rotation.x += 0.1;
      p.rotation.y += 0.1;
      p.scale.multiplyScalar(0.95);

      if (p.scale.x < 0.01) {
        scene.remove(p);
        particles.splice(i, 1);
      }
    }
  }
}

// Run
init();
renderer.setAnimationLoop(animate);
