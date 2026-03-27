$(document).ready(function () {
    // --- CONFIGURATION ---
    // REPLACE THIS URL WITH YOUR PYTHON BACKEND URL
    const API_URL = "https://chic-duckanoo-cc77a7.netlify.app/";

    let currentFile = null;
    let currentFileBase64 = null;

    // --- NAVIGATION SYSTEM ---
    window.navTo = function (pageId) {
        $('.page').removeClass('active');
        $('#' + pageId).addClass('active');

        if (pageId === 'page-history') {
            renderHistory();
        }
        if (pageId === 'page-dashboard') {
            renderDashboard();
        }

        // Update URL to preserve SPA state structurally
        if (history.pushState) {
            history.pushState(null, null, '#' + pageId);
        } else {
            window.location.hash = '#' + pageId;
        }
    };

    // Auth Function
    window.loginUser = function () {
        navTo('page-dashboard');
    }

    // Language Change Function
    window.changeLanguage = function () {
        const selectedLang = $('#language-select').val();
        if (selectedLang) {
            document.cookie = `googtrans=/en/${selectedLang}; path=/;`;
            // Save state and reload
            window.location.hash = "#page-scan";
            window.location.reload();
        }
    }

    // Initialize SPA State
    const initHash = window.location.hash.substring(1);
    if (initHash && $('#' + initHash).length > 0) {
        navTo(initHash);
    } else {
        // default fallback if no path set
        $('.page').removeClass('active');
        $('#page-login').addClass('active');
    }

    // Set language dropdown from cookie
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let c = cookies[i].trim();
        if (c.startsWith("googtrans=")) {
            let lang = c.split('/').pop();
            $('#language-select').val(lang);
            break;
        }
    }

    // PDF Function
    window.downloadPDF = function () {
        // Utilizing native print dialogue natively guarantees flawlessly rendered PDF outputs across all translated regional scripts, avoiding html2canvas ligature breakdown.
        window.print();
    }

    // --- FILE UPLOAD HANDLING ---
    $('#file-input').on('change', function (e) {
        if (this.files && this.files[0]) {
            handleFile(this.files[0]);
        }
    });

    // Drag & Drop
    $('.upload-zone').on('dragover', function (e) {
        e.preventDefault();
        $(this).addClass('bg-light');
    }).on('dragleave', function (e) {
        e.preventDefault();
        $(this).removeClass('bg-light');
    }).on('drop', function (e) {
        e.preventDefault();
        $(this).removeClass('bg-light');
        if (e.originalEvent.dataTransfer.files.length) {
            handleFile(e.originalEvent.dataTransfer.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }
        currentFile = file;

        // Preview
        const reader = new FileReader();
        reader.onload = function (e) {
            currentFileBase64 = e.target.result;
            $('#image-preview').attr('src', e.target.result).removeClass('hidden');
            $('#upload-placeholder').addClass('hidden');
            $('#btn-analyze').prop('disabled', false);
        };
        reader.readAsDataURL(file);
    }

    // --- ANALYSIS LOGIC ---
    window.startAnalysis = function () {
        if (!currentFile) return;

        // 1. Go to Loading Page
        navTo('page-loading');

        const isDemo = $('#demoMode').is(':checked');

        if (isDemo) {
            // --- MOCK SIMULATION (For Demo) ---
            setTimeout(() => {
                const mockResult = generateMockResult();
                processResult(mockResult);
            }, 2000); // 2 second fake load
        } else {
            // Build FormData
            const formData = new FormData();
            formData.append("file", currentFile);
            formData.append("contribute_data", $('#contributeData').is(':checked') ? 'true' : 'false');

            // API Call Details:
            $.ajax({
                url: API_URL,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    // Map backend response to frontend format
                    const formattedResult = {
                        condition: response.condition,
                        severity: capitalize(response.severity), // Ensure Title Case
                        confidence: response.confidence,
                        recommendation: response.recommendation,
                        explanation: response.explanation || "Analysis completed via remote server.",
                        prevention: response.prevention || "No prevention advice provided from the server."
                    };
                    processResult(formattedResult);
                },
                error: function (err) {
                    alert("Backend Error: " + JSON.stringify(err));
                    navTo('page-upload');
                }
            });
        }
    };

    let currentResultData = null;

    // --- RESULT PROCESSING & UI ---
    function processResult(data) {
        // Ensure data has ID and Date
        if (!data.id) {
            data.id = "SCAN-" + Math.random().toString(36).substr(2, 6).toUpperCase();
        }
        if (!data.date) {
            data.date = new Date().toLocaleString();
        }

        // Ensure preview exists for saving logic
        if (currentFileBase64 && !data.fromHistory) {
            data.image = currentFileBase64;
        }

        // Store globally for "Save" button
        currentResultData = data;

        // 2. Update UI
        $('#res-scan-id').text(data.id);
        $('#res-condition').text(data.condition);
        $('#res-severity').text(data.severity.toUpperCase() + " SEVERITY");
        $('#res-confidence').text(data.confidence);
        $('#res-recommendation').text(data.recommendation);
        $('#res-explanation').text(data.explanation);
        $('#res-prevention').text(data.prevention);
        $('#result-date').text(data.date);

        // Populate Image Preview
        if (data.image) {
            $('#res-image-preview').attr('src', data.image);
        } else {
            $('#res-image-preview').attr('src', '');
        }

        // Update Progress Bar (parse "92%" to 92)
        const confVal = parseInt(data.confidence);
        $('#res-progress').css('width', confVal + '%')
            .removeClass('bg-success bg-warning bg-danger')
            .addClass(confVal > 80 ? 'bg-success' : (confVal > 50 ? 'bg-warning' : 'bg-danger'));

        // dynamic colors based on severity
        const severityLower = data.severity.toLowerCase();
        const $sevBadge = $('#res-severity');
        const $recText = $('#res-recommendation');
        const $recIcon = $('#res-rec-icon');

        if (severityLower === 'low') {
            $sevBadge.css('background-color', '#22C55E').text('LOW 🟢');
            $recText.css('color', '#22C55E');
            $recIcon.css('color', '#22C55E').text('➕');
        } else if (severityLower === 'medium') {
            $sevBadge.css('background-color', '#F59E0B').text('MEDIUM 🟡');
            $recText.css('color', '#F59E0B');
            $recIcon.css('color', '#F59E0B').text('➕');
        } else { // High
            $sevBadge.css('background-color', '#EF4444').text('HIGH 🔴');
            $recText.css('color', '#EF4444');
            $recIcon.css('color', '#EF4444').text('➕');
        }

        // 4. Show Result
        navTo('page-result');
        $('#btn-save-res').html('<i class="fas fa-save me-1"></i> Save').prop('disabled', false); // resetting the save button state on new result
    }

    window.saveOnlyResult = function () {
        if (currentResultData) {
            saveToHistory(currentResultData);
            $('#btn-save-res').html('<i class="fas fa-check me-1"></i> Saved').prop('disabled', true);
            currentResultData = null; // Prevent double saving
        }
    }

    // --- DATA PERSISTENCE (HISTORY & DASHBOARD) ---

    function saveToHistory(data) {
        let history = JSON.parse(localStorage.getItem('skin_history')) || [];
        // Prevent duplicate saves
        if (!history.find(h => h.id === data.id)) {
            history.unshift(data); // Add to top
            localStorage.setItem('skin_history', JSON.stringify(history));
        }
    }

    window.clearHistory = function () {
        if (confirm("Are you sure you want to delete all patient history?")) {
            localStorage.removeItem('skin_history');
            renderHistory();
        }
    }

    function renderHistory() {
        let history = JSON.parse(localStorage.getItem('skin_history')) || [];
        const $list = $('#history-list');
        $list.empty();

        if (history.length === 0) {
            $list.html(`
                <div class="col-12 text-center mt-5 text-muted">
                    <i class="fas fa-folder-open fa-3x mb-3"></i>
                    <p>No scans recorded yet.</p>
                </div>`);
            return;
        }

        history.forEach(item => {
            let borderClass = 'sev-mild';
            if (item.severity.toLowerCase() === 'medium') borderClass = 'sev-moderate';
            if (item.severity.toLowerCase() === 'high') borderClass = 'sev-severe';

            const html = `
                <div class="col-12 mb-3">
                    <div class="card shadow-sm history-card ${borderClass}" style="cursor: pointer;" onclick="viewHistoryItem('${item.id}')">
                        <div class="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="fw-bold mb-1">${item.condition}</h6>
                                <small class="text-muted"><i class="fas fa-fingerprint me-1"></i>${item.id} &bull; ${item.date}</small>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-light text-dark border">${item.severity}</span>
                                <div class="small text-primary fw-bold mt-1">${item.confidence}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            $list.append(html);
        });
    }

    window.viewHistoryItem = function (id) {
        let history = JSON.parse(localStorage.getItem('skin_history')) || [];
        const item = history.find(h => h.id === id);
        if (item) {
            item.fromHistory = true;
            processResult(item);
            $('#btn-save-res').html('<i class="fas fa-check me-1"></i> Saved').prop('disabled', true);
        }
    };

    let severityChartInstance = null;

    function renderDashboard() {
        let history = JSON.parse(localStorage.getItem('skin_history')) || [];

        const total = history.length;
        const mild = history.filter(h => h.severity.toLowerCase() === 'low').length;
        const moderate = history.filter(h => h.severity.toLowerCase() === 'medium').length;
        const severe = history.filter(h => h.severity.toLowerCase() === 'high').length;

        // Update Numbers
        $('#dash-total').text(total);
        $('#dash-mild').text(mild);
        $('#dash-moderate').text(moderate);
        $('#dash-severe').text(severe);

        // Chart.js Setup
        const ctx = document.getElementById('severityChart').getContext('2d');
        if (severityChartInstance) {
            severityChartInstance.destroy();
        }

        severityChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Mild', 'Moderate', 'Severe'],
                datasets: [{
                    data: [mild, moderate, severe],
                    backgroundColor: ['#22C55E', '#F59E0B', '#EF4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false }
                }
            }
        });

        // Populate Recent List
        const $list = $('#dash-recent-list');
        $list.empty();

        const severeCases = history.filter(h => h.severity.toLowerCase() === 'high').slice(0, 5);
        if (severeCases.length === 0) {
            $list.html('<p class="small text-muted mb-0 text-center py-2"><i class="fas fa-check-circle text-success me-1"></i> No high-risk condition alerts recorded.</p>');
        } else {
            severeCases.forEach(item => {
                $list.append(`
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-light">
                        <div>
                            <h6 class="small fw-bold mb-0 text-dark">${item.condition}</h6>
                            <span class="small text-muted" style="font-size: 0.70rem;">${item.date}</span>
                        </div>
                        <span class="badge bg-danger rounded-pill shadow-sm" style="font-size: 0.75rem;">${item.confidence}</span>
                    </div>
                `);
            });
        }
    }

    // --- HELPER: MOCK DATA GENERATOR ---
    function generateMockResult() {
        const conditions = [
            { name: "Actinic Keratosis", sev: "Low", rec: "Treat locally with cryotherapy.", exp: "Detected rough, scaly patches typical of sun damage.", prev: "Use broad-spectrum sunscreen daily and wear protective clothing." },
            { name: "Dermatitis", sev: "Medium", rec: "Monitor and prescribe antihistamines.", exp: "Visible inflammation and redness patterns consistent with eczema.", prev: "Moisturize regularly and avoid known allergens or harsh soaps." },
            { name: "Melanoma Suspicion", sev: "High", rec: "Refer to oncologist immediately.", exp: "Irregular borders and asymmetrical coloring detected.", prev: "Avoid excessive sun exposure and perform monthly self-examinations." },
            { name: "Basal Cell Carcinoma", sev: "Medium", rec: "Monitor and schedule dermatology visit.", exp: "Pearly papule with telangiectasia observed.", prev: "Minimize midday sun exposure and rely on protective hats." },
            { name: "Benign Nevus", sev: "Low", rec: "No action needed.", exp: "Symmetrical mole with uniform color.", prev: "Simply monitor for any sudden changes in size, shape, or color." }
        ];
        const random = conditions[Math.floor(Math.random() * conditions.length)];
        const randomConf = Math.floor(Math.random() * (99 - 85) + 85);

        return {
            condition: random.name,
            severity: random.sev,
            confidence: randomConf + "%",
            recommendation: random.rec,
            explanation: random.exp,
            prevention: random.prev
        };
    }

    function capitalize(s) {
        return s && s[0].toUpperCase() + s.slice(1);
    }
});
