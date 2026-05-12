document.addEventListener('DOMContentLoaded', function() {

    // --- DATA ---
    const facultyData = [
        { name: "Ashraful Islam Chowdhury", designation: "Professor" },
        { name: "Dr. Md. Zakir Hossain Bhuiyan", designation: "Professor" },
        { name: "Dr. Anisur Rahman", designation: "Professor" },
        { name: "Dr. Md. Mizanur Rahman", designation: "Professor" },
        { name: "Dr. Serajul Hoque", designation: "Professor & Chairman" },
        { name: "Dr. Mubina Khondkar", designation: "Professor" },
        { name: "Dr. ABM Shahidul Islam", designation: "Professor" },
        { name: "Dr. Samir Kumar Sheel", designation: "Professor" },
        { name: "Abu Naser Ahmed Ishtiaque", designation: "Professor" },
        { name: "Dr. Md. Morshed Hasan Khan", designation: "Professor" },
        { name: "Dr. Imrana Yasmin", designation: "Professor" },
        { name: "Dr. Md. Moktar Ali", designation: "Professor" },
        { name: "Dr. Nasrin Akter", designation: "Professor" },
        { name: "Dr. Shehely Parvin", designation: "Professor" },
        { name: "Dr. Mohammad Anwar Hossain", designation: "Professor" },
        { name: "Dr. Rafiuddin Ahmed", designation: "Professor" },
        { name: "Dr. Md. Nazmul Hossain", designation: "Professor" },
        { name: "Dr. Abureza M Muzareba", designation: "Professor" },
        { name: "Muhammad Intisar Alam", designation: "Associate Professor" },
        { name: "Ali Mohammad Kowser", designation: "Assistant Professor" },
        { name: "Md. Imrul Jobaid", designation: "Assistant Professor" },
        { name: "Rucsar Jabin", designation: "Assistant Professor" },
        { name: "Jannatul Fardues Airin", designation: "Lecturer" },
        { name: "Dr. Razia Begum", designation: "Professor (LPR)" }
    ];

    const courseData = [
        { code: "MKT-112", name: "Principles of Management" },
        { code: "MKT-113", name: "Microeconomics" },
        { code: "MKT-114", name: "Computing and Information Systems" },
        { code: "MKT-115", name: "Bangladesh Studies" },
        { code: "MKT-121", name: "Macroeconomics" },
        { code: "MKT-122", name: "Financial Accounting" },
        { code: "MKT-123", name: "Business Mathematics – I" },
        { code: "MKT-124", name: "Business Communication" },
        { code: "MKT-125", name: "General Science & Environment" },
        { code: "MKT-211", name: "Principles of Marketing – I" },
        { code: "MKT-212", name: "Financial Management" },
        { code: "MKT-213", name: "Human Resource Management" },
        { code: "MKT-214", name: "Insurance and Risk Management" },
        { code: "MKT-215", name: "Business Mathematics - II" },
        { code: "MKT-221", name: "Principles of Marketing - II" },
        { code: "MKT-222", name: "Agricultural Marketing" },
        { code: "MKT-223", name: "Taxation & Auditing" },
        { code: "MKT-224", name: "Business Statistics – I" },
        { code: "MKT-225", name: "Fundamentals of Psychology" },
        { code: "MKT-311", name: "Marketing Management" },
        { code: "MKT-312", name: "Organizational Behavior" },
        { code: "MKT-313", name: "Integrated Marketing Communications" },
        { code: "MKT-314", name: "E- business" },
        { code: "MKT-315", name: "Business Statistics – II" },
        { code: "MKT-321", name: "Legal Aspects of Marketing" },
        { code: "MKT-322", name: "Advertising" },
        { code: "MKT-323", name: "Entrepreneurship Development" },
        { code: "MKT-324", name: "Operations Management" },
        { code: "MKT-325", name: "Supply Chain Management" },
        { code: "MKT-411", name: "Global Marketing" },
        { code: "MKT-412", name: "Product Planning and Development" },
        { code: "MKT-413", name: "International Economics" },
        { code: "MKT-414", name: "Corporate Governance & Social Responsibility" },
        { code: "MKT-415", name: "Econometrics" },
        { code: "MKT-421", name: "Brand Management" },
        { code: "MKT-422", name: "Marketing Research" },
        { code: "MKT-423", name: "Selling and Sales Management" },
        { code: "MKT-424", name: "Consumer Behavior" },
        { code: "MKT-425", name: "Services Marketing" }, 
        { code: "MKT-511", name: "Advanced Marketing Management" },
        { code: "MKT-512", name: "Marketing Analytics" },
        { code: "MKT-513", name: "Non-Profit & Social Marketing" },
        { code: "MKT-514", name: "Business Marketing" },
        { code: "MKT-515", name: "Strategic Marketing" },
        { code: "MKT-521", name: "Advanced Marketing Research" },
        { code: "MKT-522", name: "Relationship Marketing" },
        { code: "MKT-523", name: "Digital Marketing" },
        { code: "MKT-524", name: "Marketing Thoughts" },
        { code: "MKT-525", name: "Strategic Management" }
    ];
    
    // --- DOM ELEMENTS ---
    const inputPage = document.getElementById('input-page');
    const templatePage = document.getElementById('template-page');
    const form = document.getElementById('cover-form');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const downloadBtn = document.getElementById('download-btn');

    const courseNameInput = document.getElementById('courseName');
    const courseCodeInput = document.getElementById('courseCode');
    const courseSuggestionsContainer = document.getElementById('course-suggestions');

    const teacherNameInput = document.getElementById('teacherName');
    const teacherSuggestionsContainer = document.getElementById('teacher-suggestions');
    
    const dateInput = document.getElementById('submissionDate');
    const useTodayCheckbox = document.getElementById('use-today-date');
    const previewContainer = document.getElementById('preview-container');
    const previewHeading = document.getElementById('preview-heading');
    
    // --- GLOBAL STATE ---
    let coverPageData = {};
    let selectedTeacher = null;

    // --- LOCAL STORAGE ---
    const loadStudentInfo = () => {
        document.getElementById('studentName').value = localStorage.getItem('studentName') || '';
        document.getElementById('studentId').value = localStorage.getItem('studentId') || '';
        document.getElementById('studentSection').value = localStorage.getItem('studentSection') || '';
        document.getElementById('studentBatch').value = localStorage.getItem('studentBatch') || '';
    };

    const saveStudentInfo = () => {
        localStorage.setItem('studentName', document.getElementById('studentName').value);
        localStorage.setItem('studentId', document.getElementById('studentId').value);
        localStorage.setItem('studentSection', document.getElementById('studentSection').value);
        localStorage.setItem('studentBatch', document.getElementById('studentBatch').value);
    };

    // --- RESPONSIVE PREVIEW SCALING ---
    const adjustScale = () => {
        const container = document.getElementById('preview-container');
        const page = document.querySelector('.a4-page');
        if (!container || !page) return;

        // Reset transform to let the browser natively calculate the layout boxes
        page.style.transform = 'none';
        
        // Find container width and A4 element's true CSS pixel width
        const containerWidth = container.clientWidth;
        const pageWidth = page.offsetWidth; 
        
        // Provide a 40px padding buffer (20px per side)
        const scale = (containerWidth - 40) / pageWidth;
        const finalScale = Math.min(scale, 1); // Clamp it so it doesn't zoom in beyond 100% on huge screens
        
        // Reapply scaling
        page.style.transform = `scale(${finalScale})`;
        
        // Dynamically adjust the hidden overflow wrapper bounds to match scaled item 
        // 40px offsets the top & bottom margins
        container.style.height = `${(page.offsetHeight * finalScale) + 40}px`;
    };

    window.addEventListener('resize', adjustScale); // Actively recalculate if user rotates phone/resizes browser

    // --- GENERIC AUTOCOMPLETE FUNCTION ---
    function setupAutocomplete(inputEl, suggestionsEl, data, displayField, onSelect) {
        inputEl.addEventListener('input', () => {
            const query = inputEl.value.toLowerCase();
            suggestionsEl.innerHTML = '';
            if (onSelect) onSelect(null); 
            if (query.length < 2) return;

            const filtered = data.filter(item => item[displayField].toLowerCase().includes(query));
            
            filtered.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `${item[displayField]} ${item.code ? `<small>${item.code}</small>` : ''} ${item.designation ? `<small>${item.designation}</small>` : ''}`;
                div.addEventListener('click', () => {
                    inputEl.value = item[displayField];
                    if (onSelect) onSelect(item);
                    suggestionsEl.innerHTML = '';
                });
                suggestionsEl.appendChild(div);
            });
        });
    }
    
    setupAutocomplete(courseNameInput, courseSuggestionsContainer, courseData, 'name', (selectedCourse) => {
        if (selectedCourse) courseCodeInput.value = selectedCourse.code;
    });

    setupAutocomplete(teacherNameInput, teacherSuggestionsContainer, facultyData, 'name', (selected) => {
        selectedTeacher = selected;
    });
    
    document.addEventListener('click', (e) => {
        if (!teacherNameInput.contains(e.target) && !teacherSuggestionsContainer.contains(e.target)) {
            teacherSuggestionsContainer.innerHTML = '';
        }
        if (!courseNameInput.contains(e.target) && !courseSuggestionsContainer.contains(e.target)) {
            courseSuggestionsContainer.innerHTML = '';
        }
    });

    // --- DATE LOGIC ---
    useTodayCheckbox.addEventListener('change', () => {
        if (useTodayCheckbox.checked) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
            dateInput.disabled = true;
        } else {
            dateInput.disabled = false;
        }
    });

    // --- PAGE NAVIGATION ---
    nextBtn.addEventListener('click', () => {
        if (!selectedTeacher && teacherNameInput.value) {
            const exactMatch = facultyData.find(f => f.name.toLowerCase() === teacherNameInput.value.toLowerCase().trim());
            if (exactMatch) selectedTeacher = exactMatch;
        }
        
        let isValid = true;
        form.querySelectorAll('input[required]').forEach(input => {
            if (!input.value) {
                input.classList.add('error');
                isValid = false;
            } else {
                input.classList.remove('error');
            }
        });

        if (!isValid) {
            alert('Please fill all required fields.');
            return;
        }
        
        saveStudentInfo();

        const finalTeacherData = selectedTeacher ? selectedTeacher : {
            name: teacherNameInput.value,
            designation: "" 
        };

        const dateValue = dateInput.value;
        const submissionDate = dateValue 
            ? new Date(dateValue + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'N/A';

        coverPageData = {
            title: document.getElementById('title').value,
            courseName: document.getElementById('courseName').value,
            courseCode: document.getElementById('courseCode').value,
            teacher: finalTeacherData,
            studentName: document.getElementById('studentName').value,
            studentId: document.getElementById('studentId').value,
            studentSection: document.getElementById('studentSection').value,
            studentBatch: document.getElementById('studentBatch').value,
            submissionDate: submissionDate
        };

        inputPage.classList.add('hidden');
        templatePage.classList.remove('hidden');
    });

    backBtn.addEventListener('click', () => {
        templatePage.classList.add('hidden');
        inputPage.classList.remove('hidden');
        previewContainer.classList.add('hidden');
        previewHeading.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        document.querySelectorAll('.template-choice').forEach(tc => tc.classList.remove('selected'));
    });

    // --- TEMPLATE RENDERING ---
    document.querySelectorAll('.template-choice').forEach(choice => {
        choice.addEventListener('click', () => {
            document.querySelectorAll('.template-choice').forEach(tc => tc.classList.remove('selected'));
            choice.classList.add('selected');
            const templateId = choice.dataset.template;
            renderTemplate(templateId);
        });
    });

    const renderTemplate = (templateId) => {
        const { title, courseName, courseCode, teacher, studentName, studentId, studentSection, studentBatch, submissionDate } = coverPageData;
        
        const submittedToHtml = `
            <h3>Submitted To</h3>
            <p><b>${teacher.name}</b></p>
            <p>${teacher.designation}</p>
            <p>Department of Marketing</p>
            <p>Faculty of Business Studies</p>
            <p>University of Dhaka</p>
        `;
        
        const submittedByHtml = `
            <h3>Submitted By</h3>
            <p><b>${studentName}</b></p>
            <p>ID: ${studentId}</p>
            <p>Section: ${studentSection}</p>
            <p>Batch: ${studentBatch}</p>
            <p>Department of Marketing</p>
        `;

        const templateHtml = `
            <div class="a4-page template${templateId}">
                <img src="img/du.png" class="cover-logo" alt="University of Dhaka Logo">
                <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                    <h2 class="cover-course-name">${title}</h2>
                    <p class="cover-course-code">Course Name: ${courseName}</p>
                    <p class="cover-course-code">Course Code: ${courseCode}</p>
                </div>
                <div class="info-section">
                    <div class="info-block">${submittedToHtml}</div>
                    <div class="info-block">${submittedByHtml}</div>
                </div>
                <div class="date-section">
                    <p><b>Date of Submission</b></p>
                    <p>${submissionDate}</p>
                </div>
            </div>
        `;
        
        previewContainer.innerHTML = templateHtml;
        previewContainer.classList.remove('hidden');
        previewHeading.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');

        // Immediately size the component up for phone scaling after HTML is injected
        setTimeout(adjustScale, 0); 
    };

    // --- NATIVE PDF GENERATION LOGIC ---
    downloadBtn.addEventListener('click', () => {
        // We use the browser's native print engine. Our @media print CSS takes over 
        // to hide all buttons and scale the A4 page natively, creating a 1:1 perfectly selected Text PDF.
        window.print();
    });

    // --- INITIALIZATION ---
    loadStudentInfo();

});