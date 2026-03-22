'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Estado para la temperatura global
  const [globalTemp, setGlobalTemp] = useState('');
  
  // Estado para saber qué columna estamos arrastrando
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);

  // 1. MANEJO DE ARCHIVOS (MÚLTIPLES)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setErrorMsg('');
    setGlobalTemp(''); // Reiniciamos el selector global al subir nuevos archivos
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        setData(result.data);
        setColumns(Object.keys(result.data[0]));
      } else {
        setErrorMsg("Error: " + (result.error || "No se encontraron datos"));
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Falló la conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  // 2. EDICIÓN DE CELDAS DINÁMICAS
  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    const newData = [...data];
    newData[rowIndex][colKey] = value;
    setData(newData);
  };

  // 3. ACTUALIZACIÓN MASIVA DE TEMPERATURA
  const handleGlobalTempChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaTemperatura = e.target.value;
    setGlobalTemp(nuevaTemperatura);

    // Actualizamos el campo 'Temperatura' en todas las filas a la vez
    const newData = data.map(row => ({
      ...row,
      'Temperatura': nuevaTemperatura
    }));
    
    setData(newData);
  };

  // 4. LÓGICA DE ARRASTRAR Y SOLTAR (DRAG & DROP) COLUMNAS
  const handleDragStart = (index: number) => {
    setDraggedColIdx(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedColIdx === null || draggedColIdx === index) return;

    const newColumns = [...columns];
    const [removedColumn] = newColumns.splice(draggedColIdx, 1);
    newColumns.splice(index, 0, removedColumn);
    
    setColumns(newColumns);
    setDraggedColIdx(null);
  };

  // 5. EXPORTACIÓN A EXCEL
  const exportToExcel = () => {
    if (data.length === 0) return;

    const orderedData = data.map(row => {
      const newRow: any = {};
      columns.forEach(col => {
        newRow[col] = row[col];
      });
      return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");

    XLSX.writeFile(workbook, "Datos_Exportados.xlsx");
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-full mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Procesador Múltiple de PDF a Excel</h1>
        
        <div className="mb-6">
          <input 
            type="file" 
            accept="application/pdf" 
            multiple 
            onChange={handleFileUpload} 
            disabled={loading}
            className="block w-full max-w-md text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>
        
        {loading && <p className="text-blue-600 font-semibold animate-pulse">Procesando documentos...</p>}
        {errorMsg && <p className="text-red-600 font-semibold">{errorMsg}</p>}

        {data.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Datos Extraídos ({data.length} registros)
              </h2>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* SELECTOR MASIVO DE TEMPERATURA */}
                <div className="flex items-center gap-2 bg-gray-100 p-2 rounded border border-gray-200">
                  <label htmlFor="temp-select" className="text-sm font-semibold text-gray-700">
                    Asignar Temperatura:
                  </label>
                  <select 
                    id="temp-select"
                    value={globalTemp} 
                    onChange={handleGlobalTempChange}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="REFRIGERADO">REFRIGERADO</option>
                    <option value="REFRIGERADO PELIGROSO">REFRIGERADO PELIGROSO</option>
                    <option value="AMBIENTE">AMBIENTE</option>
                    <option value="AMBIENTE PELIGROSO">AMBIENTE PELIGROSO</option>
                    <option value="CARGA GENERAL">CARGA GENERAL</option>
                  </select>
                </div>

                <button 
                  onClick={exportToExcel} 
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded shadow"
                >
                  Descargar Excel
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-500 mb-2">💡 Arrastra los encabezados de las columnas para reordenarlas. Haz clic en cualquier celda para editar su contenido.</p>

            <div className="overflow-x-auto border rounded-lg shadow-inner">
              <table className="min-w-max w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-200">
                  <tr>
                    {columns.map((col, index) => (
                      <th 
                        key={col} 
                        draggable 
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index)}
                        className={`px-4 py-3 border border-gray-300 cursor-move hover:bg-gray-300 transition-colors ${draggedColIdx === index ? 'opacity-50' : ''}`}
                        title="Arrastra para mover"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr key={rowIndex} className="bg-white border-b hover:bg-blue-50 transition-colors">
                      {columns.map((col) => (
                        <td key={`${rowIndex}-${col}`} className="px-2 py-2 border border-gray-200">
                          <input 
                            type="text" 
                            value={row[col] ?? ''} 
                            onChange={(e) => handleCellChange(rowIndex, col, e.target.value)}
                            className="w-full min-w-[100px] bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none focus:bg-white px-1 py-1"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}