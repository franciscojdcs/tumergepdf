import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PDFDocument } from 'pdf-lib';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private sanitizer = inject(DomSanitizer);
  
  pdfFiles = signal<File[]>([]);
  isMerging = signal<boolean>(false);
  isDragOver = signal<boolean>(false);
  previewUrl = signal<string | null>(null);
  safePreviewUrl = signal<SafeResourceUrl | null>(null);

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
    input.value = ''; // Reset input
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  private addFiles(files: File[]) {
    const newFiles = files.filter(file => file.type === 'application/pdf');
    this.pdfFiles.update(currentFiles => {
      // Evitar duplicados por nombre
      const currentNames = new Set(currentFiles.map(f => f.name));
      const uniqueNew = newFiles.filter(f => !currentNames.has(f.name));
      return [...currentFiles, ...uniqueNew];
    });
    this.previewUrl.set(null); // Reset preview on new files
    this.safePreviewUrl.set(null);
  }

  removeFile(index: number) {
    this.pdfFiles.update(files => files.filter((_, i) => i !== index));
    this.previewUrl.set(null);
    this.safePreviewUrl.set(null);
  }

  moveFileUp(index: number) {
    if (index === 0) return;
    this.pdfFiles.update(files => {
      const newFiles = [...files];
      const temp = newFiles[index - 1];
      newFiles[index - 1] = newFiles[index];
      newFiles[index] = temp;
      return newFiles;
    });
    this.previewUrl.set(null);
    this.safePreviewUrl.set(null);
  }

  moveFileDown(index: number) {
    if (index === this.pdfFiles().length - 1) return;
    this.pdfFiles.update(files => {
      const newFiles = [...files];
      const temp = newFiles[index + 1];
      newFiles[index + 1] = newFiles[index];
      newFiles[index] = temp;
      return newFiles;
    });
    this.previewUrl.set(null);
    this.safePreviewUrl.set(null);
  }

  async generatePreview() {
    const files = this.pdfFiles();
    if (files.length < 2) return;

    this.isMerging.set(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Clean up previous URL if it exists
      if (this.previewUrl()) {
         URL.revokeObjectURL(this.previewUrl()!);
      }
      this.previewUrl.set(url);
      this.safePreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch (error) {
      console.error('Error merging PDFs for preview:', error);
      alert('Hubo un error al unir los archivos PDF. Revisa la consola para más detalles.');
    } finally {
      this.isMerging.set(false);
    }
  }

  downloadPdf() {
    const url = this.previewUrl();
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = 'documento-unido.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
