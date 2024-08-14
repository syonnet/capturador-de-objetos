        
        const video = document.getElementById('webcam');
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const objectList = document.getElementById('object-list');
        const errorMessage = document.getElementById('error-message');
        const toggleDetectionButton = document.getElementById('toggleDetection');
        const captureImageButton = document.getElementById('captureImage');
        const confidenceThreshold = document.getElementById('confidenceThreshold');
        const confidenceValue = document.getElementById('confidenceValue');
        const detectionChart = document.getElementById('detectionChart').getContext('2d');

        let model;
        const detectedObjects = new Map();
        let trackedObjects = {};
        let isDetecting = true;
        let chart;

        async function setupCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                video.srcObject = stream;

                return new Promise((resolve) => {
                    video.onloadedmetadata = () => {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        resolve();
                    };
                });
            } catch (error) {
                console.error('Error accessing camera:', error);
                errorMessage.textContent = 'Error al acceder a la cámara. Por favor, asegúrate de que esté conectada y permita el acceso.';
            }
        }

        async function loadModel() {
            try {
                model = await cocoSsd.load();
                errorMessage.textContent = '';
            } catch (error) {
                console.error('Error loading model:', error);
                errorMessage.textContent = 'Error al cargar el modelo. Por favor, inténtalo de nuevo más tarde.';
                throw error;
            }
        }

        function drawBoundingBox(prediction) {
            const [x, y, width, height] = prediction.bbox;
            const color = `hsl(${Math.random() * 360}, 100%, 50%)`;

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = color;
            const text = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            const textWidth = ctx.measureText(text).width;
            const textHeight = parseInt(ctx.font, 10);
            ctx.fillRect(x, y - textHeight - 4, textWidth + 4, textHeight + 4);

            ctx.fillStyle = '#000000';
            ctx.fillText(text, x + 2, y - 2);
        }

        function updateObjectList(predictions) {
            objectList.innerHTML = '';
            const currentObjects = new Set(predictions.map(p => p.class));

            currentObjects.forEach(object => {
                const currentTime = new Date().toLocaleString();
                if (!detectedObjects.has(object)) {
                    detectedObjects.set(object, { count: 1, lastSeen: currentTime });
                } else {
                    const data = detectedObjects.get(object);
                    data.count++;
                    data.lastSeen = currentTime;
                    detectedObjects.set(object, data);
                }

                if (!trackedObjects[object]) {
                    trackedObjects[object] = { id: Math.random().toString(36).substr(2, 9), lastSeen: currentTime };
                } else {
                    trackedObjects[object].lastSeen = currentTime;
                }
            });

            const sortedObjects = Array.from(detectedObjects.entries()).sort(([, a], [, b]) => b.count - a.count);

            sortedObjects.forEach(([object, data], index) => {
                const li = document.createElement('li');
                li.className = 'bg-gray-700 rounded p-2 flex justify-between items-center';

                const objectId = trackedObjects[object].id;
                li.innerHTML = `
                    <span>${index + 1}. ${object} (ID: ${objectId})</span>
                    <span class="text-sm text-gray-400">Conteo: ${data.count}, Último: ${data.lastSeen}</span>
                `;
                objectList.appendChild(li);
            });

            updateChart(sortedObjects);
        }

        function updateChart(sortedObjects) {
            const labels = sortedObjects.map(([object]) => object);
            const data = sortedObjects.map(([, data]) => data.count);

            if (chart) {
                chart.data.labels = labels;
                chart.data.datasets[0].data = data;
                chart.update();
            } else {
                chart = new Chart(detectionChart, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Número de detecciones',
                            data: data,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: 'white' }
                            },
                            x: {
                                ticks: { color: 'white' }
                            }
                        },
                        plugins: {
                            legend: {
                                labels: { color: 'white' }
                            }
                        }
                    }
                });
            }
        }

        async function detectObjects() {
            if (!model || !isDetecting) return;

            try {
                const predictions = await model.detect(video);
                const threshold = parseFloat(confidenceThreshold.value);
                const filteredPredictions = predictions.filter(p => p.score >= threshold);

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                filteredPredictions.forEach(drawBoundingBox);
                updateObjectList(filteredPredictions);
            } catch (error) {
                console.error('Error during detection:', error);
            } finally {
                if (isDetecting) {
                    requestAnimationFrame(detectObjects);
                }
            }
        }

        async function run() {
            try {
                await setupCamera();
                await loadModel();
                detectObjects();
            } catch (error) {
                console.error('An error occurred:', error);
                errorMessage.textContent = 'Ocurrió un error. Por favor, revisa la consola para más detalles.';
            }
        }

        toggleDetectionButton.addEventListener('click', () => {
            isDetecting = !isDetecting;
            toggleDetectionButton.textContent = isDetecting ? 'Pausar Detección' : 'Continuar Detección';

            if (isDetecting) {
                detectObjects();
            }
        });

        captureImageButton.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = 'detected_objects.png';
            link.href = canvas.toDataURL();
            link.click();
        });

        confidenceThreshold.addEventListener('input', (e) => {
            confidenceValue.textContent = e.target.value;
        });

        run();
 