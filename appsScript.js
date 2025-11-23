function doGet(e) {
	const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
	
	if (e.parameter.action === 'getLikes') {
		const programNames = sheet.getRange('B37:AJ37').getValues()[0];
		const likesRow = sheet.getRange('B38:AJ38').getValues()[0];
		
		const likesData = {};
		
		programNames.forEach((programName, index) => {
			if (programName) {
			programName = String(programName).trim();
			likesData[programName] = parseInt(likesRow[index]) || 0;
			}
		});
		
		return ContentService
			.createTextOutput(JSON.stringify({
			status: "success",
			data: likesData
			}))
			.setMimeType(ContentService.MimeType.JSON);
	}
	
	if (e.parameter.action === 'like' && e.parameter.program) {
		try {
			const programName = String(e.parameter.program).trim();
			const programNames = sheet.getRange('B37:AJ37').getValues()[0];
			
			let columnIndex = -1;
			for (let i = 0; i < programNames.length; i++) {
			if (String(programNames[i]).trim() === programName) {
				columnIndex = i + 2;
				break;
			}
			}
			
			if (columnIndex !== -1) {
			const currentLikes = sheet.getRange(38, columnIndex).getValue();
			const newLikes = (parseInt(currentLikes) || 0) + 1;
			
			sheet.getRange(38, columnIndex).setValue(newLikes);
			
			return ContentService
				.createTextOutput(JSON.stringify({
					status: "success",
					likes: newLikes
				}))
				.setMimeType(ContentService.MimeType.JSON);
			} else {
			throw new Error('Program not found');
			}
		} catch (error) {
			return ContentService
			.createTextOutput(JSON.stringify({
				status: "error",
				message: error.toString()
			}))
			.setMimeType(ContentService.MimeType.JSON);
		}
	}
	
	if (e.parameter.action === 'getCapacity') {
		const programNames = sheet.getRange('B37:AJ37').getValues()[0];
		const firstBlockCapacity = sheet.getRange('B39:AJ39').getValues()[0];
		const secondBlockCapacity = sheet.getRange('B40:AJ40').getValues()[0];
		
		const lastRow = Math.max(sheet.getLastRow(), 44);
		const firstProgramColumn = lastRow >= 45 ? sheet.getRange('C45:C' + lastRow).getValues().map(row => String(row[0]).trim()) : [];
		const secondProgramColumn = lastRow >= 45 ? sheet.getRange('D45:D' + lastRow).getValues().map(row => String(row[0]).trim()) : [];
		
		const capacityData = {};
		
		programNames.forEach((programName, index) => {
			if (programName) {
			programName = String(programName).trim();
			
			const firstBlockVal = firstBlockCapacity[index];
			const secondBlockVal = secondBlockCapacity[index];
			
			const firstBlockCount = firstProgramColumn.filter(prog => prog === programName).length;
			const secondBlockCount = secondProgramColumn.filter(prog => prog === programName).length;
			
			const isMerged = (firstBlockVal !== '' && firstBlockVal != null && firstBlockVal !== 'NEPŘEDNÁŠÍ') && 
									(secondBlockVal === '' || secondBlockVal == null);
			
			if (isMerged) {
				let mergedCount = 0;
				for (let i = 0; i < firstProgramColumn.length; i++) {
					if (firstProgramColumn[i] === programName && secondProgramColumn[i] === programName) {
					mergedCount++;
					}
				}
				
				const totalMax = parseInt(firstBlockVal) || 0;
				
				capacityData[programName] = {
					type: 'spojene',
					current: mergedCount,
					max: totalMax
				};
			} else {
				const firstBlockMax = (firstBlockVal === 'NEPŘEDNÁŠÍ' || firstBlockVal === '' || firstBlockVal == null) ? null : parseInt(firstBlockVal);
				const secondBlockMax = (secondBlockVal === 'NEPŘEDNÁŠÍ' || secondBlockVal === '' || secondBlockVal == null) ? null : parseInt(secondBlockVal);
				
				capacityData[programName] = {
					type: 'separate',
					firstBlock: {
					current: firstBlockCount,
					max: firstBlockMax,
					available: firstBlockMax !== null
					},
					secondBlock: {
					current: secondBlockCount,
					max: secondBlockMax,
					available: secondBlockMax !== null
					}
				};
			}
			}
		});
		
		return ContentService
			.createTextOutput(JSON.stringify({
			status: "success",
			data: capacityData
			}))
			.setMimeType(ContentService.MimeType.JSON);
	}
	
	if (e.parameter.name && e.parameter.class) {
		const lock = LockService.getScriptLock();
		
		try {
			lock.waitLock(30000);
			
			const name = String(e.parameter.name).trim();
			const className = String(e.parameter.class).trim();
			const firstProgram = String(e.parameter.firstProgram || '').trim();
			const secondProgram = String(e.parameter.secondProgram || '').trim();
			
			const programNames = sheet.getRange('B37:AJ37').getValues()[0];
			const firstBlockCapacity = sheet.getRange('B39:AJ39').getValues()[0];
			const secondBlockCapacity = sheet.getRange('B40:AJ40').getValues()[0];
			
			const lastRow = Math.max(sheet.getLastRow(), 44);
			const firstProgramColumn = lastRow >= 45 ? sheet.getRange('C45:C' + lastRow).getValues().map(row => String(row[0]).trim()) : [];
			const secondProgramColumn = lastRow >= 45 ? sheet.getRange('D45:D' + lastRow).getValues().map(row => String(row[0]).trim()) : [];
			
			function checkCapacity(programName, blockType) {
			const index = programNames.findIndex(name => String(name).trim() === programName);
			if (index === -1) return { ok: true };
			
			const firstBlockVal = firstBlockCapacity[index];
			const secondBlockVal = secondBlockCapacity[index];
			
			const isMerged = (firstBlockVal !== '' && firstBlockVal != null && firstBlockVal !== 'NEPŘEDNÁŠÍ') && 
									(secondBlockVal === '' || secondBlockVal == null);
			
			if (isMerged) {
				let mergedCount = 0;
				for (let i = 0; i < firstProgramColumn.length; i++) {
					if (firstProgramColumn[i] === programName && secondProgramColumn[i] === programName) {
					mergedCount++;
					}
				}
				const maxCapacity = parseInt(firstBlockVal) || 0;
				if (mergedCount >= maxCapacity) {
					return { ok: false, reason: `${programName} je plný (${mergedCount}/${maxCapacity})` };
				}
			} else {
				if (blockType === 'first') {
					const firstBlockMax = (firstBlockVal === 'NEPŘEDNÁŠÍ' || firstBlockVal === '' || firstBlockVal == null) ? null : parseInt(firstBlockVal);
					if (firstBlockMax !== null) {
					const firstBlockCount = firstProgramColumn.filter(prog => prog === programName).length;
					if (firstBlockCount >= firstBlockMax) {
						return { ok: false, reason: `${programName} (Blok 1) je plný (${firstBlockCount}/${firstBlockMax})` };
					}
					}
				} else if (blockType === 'second') {
					const secondBlockMax = (secondBlockVal === 'NEPŘEDNÁŠÍ' || secondBlockVal === '' || secondBlockVal == null) ? null : parseInt(secondBlockVal);
					if (secondBlockMax !== null) {
					const secondBlockCount = secondProgramColumn.filter(prog => prog === programName).length;
					if (secondBlockCount >= secondBlockMax) {
						return { ok: false, reason: `${programName} (Blok 2) je plný (${secondBlockCount}/${secondBlockMax})` };
					}
					}
				}
			}
			
			return { ok: true };
			}
			
			const firstCheck = checkCapacity(firstProgram, 'first');
			if (!firstCheck.ok) {
			lock.releaseLock();
			return ContentService
				.createTextOutput(JSON.stringify({
					status: "error",
					message: firstCheck.reason
				}))
				.setMimeType(ContentService.MimeType.JSON);
			}
			
			const secondCheck = checkCapacity(secondProgram, 'second');
			if (!secondCheck.ok) {
			lock.releaseLock();
			return ContentService
				.createTextOutput(JSON.stringify({
					status: "error",
					message: secondCheck.reason
				}))
				.setMimeType(ContentService.MimeType.JSON);
			}
			
			let targetRow = lastRow < 45 ? 45 : lastRow + 1;
			sheet.getRange(targetRow, 1, 1, 4).setValues([[
			name,
			className,
			firstProgram,
			secondProgram
			]]);
			
			lock.releaseLock();
			
			return ContentService
			.createTextOutput(JSON.stringify({
				status: "success",
				message: "Registration saved"
			}))
			.setMimeType(ContentService.MimeType.JSON);
			
		} catch (error) {
			lock.releaseLock();
			return ContentService
			.createTextOutput(JSON.stringify({
				status: "error",
				message: error.toString()
			}))
			.setMimeType(ContentService.MimeType.JSON);
		}
	}
	
	return ContentService
		.createTextOutput(JSON.stringify({
			status: "error",
			message: "Invalid request"
		}))
		.setMimeType(ContentService.MimeType.JSON);
}