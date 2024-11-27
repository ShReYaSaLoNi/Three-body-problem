const SECONDS_PER_RENDER_LOOP = 3600;
const METRES_PER_RENDER_UNIT = 25000000;
const KILOMETRES_PER_RENDER_UNIT = METRES_PER_RENDER_UNIT / 1000;
const G = 0.0000000000667430;

const MASS_BODY1 = 10;
const MASS_BODY2 = 20;
const MASS_BODY3 = 30;

const getVelocity = function (querySelector) {
    var input = document.querySelector(querySelector);
    var velocityString = input.value;
    var positions = velocityString.replace('(', '').replace(')', '').split(',');

    return positions.map(pos => parseFloat(pos) / KILOMETRES_PER_RENDER_UNIT);
}

const getPosition = function (querySelector) {
    var input = document.querySelector(querySelector);
    var positionString = input.value;
    var positions = positionString.replace('(', '').replace(')', '').split(',');

    return positions.map(pos => parseFloat(pos) / KILOMETRES_PER_RENDER_UNIT);
}

function calculateCenterOfMass(bodies) {
    let totalMass = 0;
    let centerX = 0, centerY = 0, centerZ = 0;

    bodies.forEach(body => {
        totalMass += body.mass;
        centerX += body.position.x * body.mass;
        centerY += body.position.y * body.mass;
        centerZ += body.position.z * body.mass;
    });

    return {
        x: centerX / totalMass,
        y: centerY / totalMass,
        z: centerZ / totalMass
    };
}

function initBody(body, velocity) {
    body.velx = velocity[0];
    body.vely = velocity[1];
    body.velz = velocity[2];
    body.accx = 0;
    body.accy = 0;
    body.accz = 0;
}

function applyPhysics(bodies) {
    // Reset accelerations
    bodies.forEach(body => {
        body.accx = 0;
        body.accy = 0;
        body.accz = 0;
    });

    // Calculate forces
    for (let i = 0; i < bodies.length - 1; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const body1 = bodies[i];
            const body2 = bodies[j];

            const deltax = body1.position.x - body2.position.x;
            const deltay = body1.position.y - body2.position.y;
            const deltaz = body1.position.z - body2.position.z;

            const r = Math.sqrt(
                Math.pow(deltax, 2) +
                Math.pow(deltay, 2) +
                Math.pow(deltaz, 2)
            ) * METRES_PER_RENDER_UNIT;

            const force = G * body1.mass * body2.mass / Math.pow(r, 2);
            const forcex = (deltax / r) * force;
            const forcey = (deltay / r) * force;
            const forcez = (deltaz / r) * force;

            body1.accx -= (forcex / body1.mass);
            body1.accy -= (forcey / body1.mass);
            body1.accz -= (forcez / body1.mass);
            body2.accx += (forcex / body2.mass);
            body2.accy += (forcey / body2.mass);
            body2.accz += (forcez / body2.mass);
        }
    }

    // Update velocities and positions
    bodies.forEach(body => {
        body.velx += body.accx * SECONDS_PER_RENDER_LOOP;
        body.vely += body.accy * SECONDS_PER_RENDER_LOOP;
        body.velz += body.accz * SECONDS_PER_RENDER_LOOP;

        body.position.x += body.velx * SECONDS_PER_RENDER_LOOP;
        body.position.y += body.vely * SECONDS_PER_RENDER_LOOP;
        body.position.z += body.velz * SECONDS_PER_RENDER_LOOP;
    });
}


const simulate = async function () {

    // Clear any existing simulation
    const simulationFrame = document.querySelector('.simulation-frame');
    simulationFrame.innerHTML = '';

    // Setup scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, (window.innerWidth - 360) / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth - 360, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    simulationFrame.appendChild(renderer.domElement);

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;

    // Add lights
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(10, 10, 10).normalize();
    scene.add(dirLight1);

    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

    // Setup inset
    const insetWidth = 150, insetHeight = 150;
    const container2 = document.getElementById('inset');
    container2.innerHTML = '';

    const renderer2 = new THREE.WebGLRenderer({ alpha: true });
    renderer2.setClearColor(0x000000, 0);
    renderer2.setSize(insetWidth, insetHeight);
    container2.appendChild(renderer2.domElement);

    const scene2 = new THREE.Scene();
    const camera2 = new THREE.PerspectiveCamera(50, insetWidth / insetHeight, 1, 1000);
    camera2.up = camera.up;

    const axes2 = new THREE.AxesHelper(100);
    scene2.add(axes2);

    // Create bodies
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const materials = [
        new THREE.MeshPhongMaterial({ color: 0x3273a8, shininess: 15 }),
        new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 15 }),
        new THREE.MeshPhongMaterial({ color: 0xe5eb34, shininess: 15 })
    ];

    const bodies = [];
    const inputData = [];

    for (let i = 1; i <= 3; i++) {
        const mass = i === 1 ? MASS_BODY1 : i === 2 ? MASS_BODY2 : MASS_BODY3;
        var velocity = getVelocity(`#body${i}-velocity`);
        var position = getPosition(`#body${i}-position`);

        inputData.push(position[0] * KILOMETRES_PER_RENDER_UNIT, position[1] * KILOMETRES_PER_RENDER_UNIT,
            position[2] * KILOMETRES_PER_RENDER_UNIT,
            velocity[0] * KILOMETRES_PER_RENDER_UNIT, velocity[1] * KILOMETRES_PER_RENDER_UNIT,
            velocity[2] * KILOMETRES_PER_RENDER_UNIT);
        const sphere = new THREE.Mesh(geometry, materials[i - 1]);
        sphere.position.set(position[0], position[1], position[2]);
        sphere.mass = mass;

        initBody(sphere, velocity);
        scene.add(sphere);
        bodies.push(sphere);
    }

    // Set initial camera position
    camera.position.set(0, 50, 100);
    camera.lookAt(0, 0, 0);


    const duration = 1;
    let remainingTime = duration;

    console.log('Sending data to API:', inputData);

    try {
        // Make a POST request to the /predict endpoint
        const response = await fetch('http://localhost:8000/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: inputData })
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${errorData?.detail || 'Unknown error'}`);
        }

        const result = await response.json();

        console.log('Prediction:', result.prediction);

        // Update the simulation with the prediction result
    } catch (error) {
        console.error('Error during simulation:', error);
    }

    function animate() {
        requestAnimationFrame(animate);

        // Update physics
        applyPhysics(bodies);

        // Calculate the center of mass
        const centerOfMass = calculateCenterOfMass(bodies);

        // Update camera to look at the center of mass
        camera.position.sub(controls.target); // Remove current target offset
        controls.target.set(centerOfMass.x, centerOfMass.y, centerOfMass.z);
        camera.position.add(controls.target); // Add new target offset

        // Update controls
        controls.update();

        // Update inset view
        camera2.position.copy(camera.position);
        camera2.position.sub(controls.target);
        camera2.position.setLength(300);
        camera2.lookAt(scene2.position);

        // Render both views
        renderer.render(scene, camera);
        renderer2.render(scene2, camera2);

        remainingTime -= SECONDS_PER_RENDER_LOOP;

        if (remainingTime <= 0) {
            console.log('Simulation completed');
            const finalState = {
                simulationTime: duration,
                bodies: bodies.map((body, i) => ({
                    id: i + 1,
                    position: {
                        x: body.position.x * KILOMETRES_PER_RENDER_UNIT,
                        y: body.position.y * KILOMETRES_PER_RENDER_UNIT,
                        z: body.position.z * KILOMETRES_PER_RENDER_UNIT
                    },
                    velocity: {
                        x: body.velx * KILOMETRES_PER_RENDER_UNIT,
                        y: body.vely * KILOMETRES_PER_RENDER_UNIT,
                        z: body.velz * KILOMETRES_PER_RENDER_UNIT
                    }
                }))
            };
            console.log('Final state:', finalState);
        }
    }

    animate();
};


window.simulate = simulate;

