import { NextResponse } from 'next/server';

const PDFParser = require('pdf2json');

// Función auxiliar para extraer el texto de un solo buffer de PDF
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.parseBuffer(buffer);
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    // ¡NUEVO! Extraemos TODOS los archivos que vengan con la llave 'files'
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se subieron archivos' }, { status: 400 });
    }

    let todosLosProductos: any[] = [];

    // Iteramos por cada PDF subido
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const rawText = await extractTextFromBuffer(buffer);

      // --- EXTRACCIÓN DE DATOS GENERALES ---
      const facturaMatch = rawText.match(/Factura N°\s+(\d+)/);
      const numeroFactura = facturaMatch ? facturaMatch[1] : '';

      const fechaEmisionMatch = rawText.match(/Fecha de Factura\s+(\d{2}\.\d{2}\.\d{4})/);
      const fechaEmision = fechaEmisionMatch ? fechaEmisionMatch[1] : '';

      const marcaMatch = rawText.match(/Marca\s+(\d+)/);
      const marca = marcaMatch ? marcaMatch[1] : '';

      // ¡NUEVO! Extracción del No. Pedido
      const pedidoMatch = rawText.match(/No\. Pedido\s+(.+)/);
      const numeroPedido = pedidoMatch ? pedidoMatch[1].trim() : '';

      // --- EXTRACCIÓN DE PRODUCTOS ---
      const lineas = rawText.split('\n');
      let productoActual: any = null;

      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i].trim();

        // Detectar inicio de producto
        const matchInicio = linea.match(/^(\d+)\s+(\d{10,})/);

        if (matchInicio) {
          if (productoActual) todosLosProductos.push(productoActual);

          // Estructura actualizada con "No. Pedido"
          productoActual = {
            'Código': matchInicio[2],
            'Descripción': '',
            'PMP': '',
            'Categoria': '',
            'Temperatura': '',
            'Factura N°': numeroFactura,
            'Fecha Factura': fechaEmision,
            'País de Origen': '',
            'N° Lote': '',
            'Caducidad': '',
            'Packing List': marca,
            'No. Pedido': numeroPedido, // <- Agregado aquí al lado de Packing list
            'Cant/ Factura (Unidades)': '',
            'Precio Unitario de Factura': '',
            'Valor Factura': '',
            'Codigo Arancelario': '',
            'Guia / BL': ''
          };

          // ¡NUEVO! Lógica robusta para la descripción y precios
          let lineasDescripcion = [];
          
          // Miramos las siguientes líneas (hasta 6 líneas hacia adelante)
          for (let j = i + 1; j < Math.min(i + 7, lineas.length); j++) {
            const lineaJ = lineas[j].trim();
            
            // Si llegamos a "País de Origen", dejamos de buscar la descripción
            if (lineaJ.startsWith('País de Origen')) {
              break; 
            }

            // ¿Es la línea de las cantidades y precios?
            const matchValores = lineaJ.match(/^(\d+)\s+PZA.*?([\d,]+\.\d{2}).*?([\d,]+\.\d{2})$/);
            
            if (matchValores) {
              productoActual['Cant/ Factura (Unidades)'] = Number(matchValores[1]);
              productoActual['Precio Unitario de Factura'] = Number(matchValores[2].replace(/,/g, ''));
              productoActual['Valor Factura'] = Number(matchValores[3].replace(/,/g, ''));
            } else if (lineaJ !== '') {
              // Si no son los precios, no es el país, y no está vacía, ¡Es parte de la descripción!
              lineasDescripcion.push(lineaJ);
            }
          }
          
          // Unimos las líneas encontradas
          productoActual['Descripción'] = lineasDescripcion.join(' ').trim();
        }

        // País de Origen
        if (productoActual && linea.startsWith('País de Origen')) {
            const matchOrigen = linea.match(/País de Origen\s+(.+)/);
            if (matchOrigen) productoActual['País de Origen'] = matchOrigen[1].trim();
        }

        // Lote y Caducidad
        if (productoActual && linea.startsWith('Lote / NS')) {
          const matchLote = linea.match(/Lote \/ NS\s+([A-Za-z0-9]+)/);
          if (matchLote) productoActual['N° Lote'] = matchLote[1];

          const matchVto = linea.match(/Fecha Vto\.\s+(\d{2}\.\d{2}\.\d{4})/);
          if (matchVto) productoActual['Caducidad'] = matchVto[1];
        }
      }

      if (productoActual) todosLosProductos.push(productoActual);
    }

    return NextResponse.json({ success: true, data: todosLosProductos });

  } catch (error) {
    console.error("Error procesando los PDFs:", error);
    return NextResponse.json({ error: 'Error al procesar los documentos' }, { status: 500 });
  }
}