// อ่านค่าค้นหาแล้วกรองข่าวจากหัวข้อและสรุป
const newsSearchForm = document.querySelector(".news-search");
const newsSearchInput = document.querySelector("#news-search-input");
const newsSearchEmptyMessage = document.querySelector("#news-search-empty");
const newsCards = Array.from(document.querySelectorAll(".news-card"));

function normalizeSearchText(text) {
    return text.normalize("NFC").toLocaleLowerCase("th-TH");
}

// ทำให้ข้อความปลอดภัยเมื่อนำไปใช้สร้าง regular expression
function escapeRegularExpression(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// เน้นคำที่ตรงกันด้วย <mark> โดยไม่แทรกข้อความค้นหาเป็น HTML
function highlightHeadline(headlineElement, searchText) {
    if (!headlineElement.dataset.originalHeadline) {
        headlineElement.dataset.originalHeadline = headlineElement.textContent;
    }

    const originalHeadline = headlineElement.dataset.originalHeadline;
    if (!searchText) {
        headlineElement.textContent = originalHeadline;
        return;
    }

    const matchingParts = new RegExp(`(${escapeRegularExpression(searchText)})`, "giu");
    const textParts = originalHeadline.split(matchingParts);
    const headlineFragment = document.createDocumentFragment();
    const normalizedSearchText = normalizeSearchText(searchText);

    textParts.forEach((textPart) => {
        if (normalizeSearchText(textPart) === normalizedSearchText) {
            const highlightMark = document.createElement("mark");
            highlightMark.className = "news-search-highlight";
            highlightMark.textContent = textPart;
            headlineFragment.appendChild(highlightMark);
        } else {
            headlineFragment.appendChild(document.createTextNode(textPart));
        }
    });

    headlineElement.replaceChildren(headlineFragment);
}

function filterNewsCards() {
    const searchText = newsSearchInput.value.trim().normalize("NFC");
    const normalizedSearchText = normalizeSearchText(searchText);
    let visibleNewsCount = 0;

    newsCards.forEach((newsCard) => {
        const headlineElement = newsCard.querySelector("h3");
        const summaryElement = newsCard.querySelector(".news-summary");
        const originalHeadline = headlineElement.dataset.originalHeadline || headlineElement.textContent;
        const searchableSummary = summaryElement.cloneNode(true);
        searchableSummary.querySelectorAll("br").forEach((lineBreak) => lineBreak.replaceWith(" "));
        const summaryText = searchableSummary.textContent;
        const searchableText = normalizeSearchText(`${originalHeadline} ${summaryText}`);
        const matchesSearch = normalizedSearchText === "" || searchableText.includes(normalizedSearchText);

        newsCard.hidden = !matchesSearch;
        highlightHeadline(headlineElement, searchText);

        if (matchesSearch) {
            visibleNewsCount += 1;
        }
    });

    newsSearchEmptyMessage.hidden = visibleNewsCount > 0;
}

if (newsSearchInput && newsSearchEmptyMessage) {
    newsSearchInput.addEventListener("input", filterNewsCards);
}

if (newsSearchForm) {
    newsSearchForm.addEventListener("submit", (event) => event.preventDefault());
}

// สร้าง PDF จากภาพที่เบราว์เซอร์เรนเดอร์ เพื่อคงฟอนต์และวรรณยุกต์ภาษาไทย
async function downloadNewsAsPdf(newsCard, downloadButton) {
    const headline = newsCard.querySelector("h3").textContent.trim();
    const date = newsCard.querySelector("time").textContent.trim();
    const fileName = `${headline.replace(/\s+/g, "-")}.pdf`;
    const originalButtonLabel = downloadButton.textContent;
    const { jsPDF } = window.jspdf || {};

    if (typeof window.html2canvas !== "function" || typeof jsPDF !== "function") {
        window.alert("โหลดเครื่องมือสร้าง PDF ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่");
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = "กำลังสร้าง PDF…";
    newsCard.classList.add("is-exporting");

    try {
        const fontSample = `${headline} ${date} ${newsCard.querySelector(".news-summary").textContent}`;
        if (document.fonts && typeof document.fonts.load === "function") {
            const thaiFontFaces = await document.fonts.load('16px "Noto Sans Thai"', fontSample);
            await document.fonts.ready;

            if (thaiFontFaces.length === 0) {
                throw new Error("โหลดฟอนต์ Noto Sans Thai ไม่สำเร็จ");
            }
        }

        const renderedNewsCard = await window.html2canvas(newsCard, {
            backgroundColor: "#ffffff",
            logging: false,
            scale: 2,
        });

        if (!renderedNewsCard.width || !renderedNewsCard.height) {
            throw new Error("สร้างภาพข่าวสำหรับ PDF ไม่สำเร็จ");
        }

        const pdfDocument = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = pdfDocument.internal.pageSize.getWidth();
        const pageHeight = pdfDocument.internal.pageSize.getHeight();
        const pageMargin = 15;
        const imageWidth = pageWidth - (pageMargin * 2);
        const imageHeight = renderedNewsCard.height * imageWidth / renderedNewsCard.width;
        const imageData = renderedNewsCard.toDataURL("image/png");
        const pageContentHeight = pageHeight - (pageMargin * 2);

        for (let verticalOffset = 0; verticalOffset < imageHeight; verticalOffset += pageContentHeight) {
            if (verticalOffset > 0) {
                pdfDocument.addPage();
            }

            pdfDocument.addImage(
                imageData,
                "PNG",
                pageMargin,
                pageMargin - verticalOffset,
                imageWidth,
                imageHeight
            );
        }

        pdfDocument.save(fileName);
    } catch (error) {
        console.error("สร้าง PDF ไม่สำเร็จ:", error);
        window.alert("สร้าง PDF ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองใหม่อีกครั้ง");
    } finally {
        newsCard.classList.remove("is-exporting");
        downloadButton.disabled = false;
        downloadButton.textContent = originalButtonLabel;
    }
}

// ใช้ event delegation สำหรับปุ่มดาวน์โหลดของการ์ดข่าวทุกใบ
const newsList = document.querySelector(".news-section");

if (newsList) {
    newsList.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) {
            return;
        }

        const downloadButton = event.target.closest(".download-pdf-button");
        if (!downloadButton) {
            return;
        }

        const newsCard = downloadButton.closest(".news-card");
        if (newsCard) {
            downloadNewsAsPdf(newsCard, downloadButton);
        }
    });
}
