
export interface UserProfile {
  name: string;
  email: string;
  picture: string;
  accessToken: string;
}

const SHEET_NAME = 'School_Schedule_Data';

// Google Auth 초기화
export const initGoogleAuth = (onUserChange: (user: UserProfile | null) => void, clientId: string) => {
  if (!(window as any).google) return null;
  
  return (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
    callback: async (response: any) => {
      if (response.access_token) {
        // 유저 프로필 정보 가져오기
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` }
        }).then(res => res.json());

        const user: UserProfile = {
          name: userInfo.name || '사용자',
          email: userInfo.email || '',
          picture: userInfo.picture || '',
          accessToken: response.access_token
        };
        onUserChange(user);
      }
    },
  });
};

// 시트 파일 찾기 또는 생성 후 데이터 저장
export const saveToGoogleSheet = async (token: string, data: any) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. 파일 검색 (Drive API)
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id)`,
      { headers }
    );
    const searchData = await searchResponse.json();
    let spreadsheetId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    // 2. 파일이 없으면 생성
    if (!spreadsheetId) {
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: SHEET_NAME,
          mimeType: 'application/vnd.google-apps.spreadsheet',
        }),
      });
      const createData = await createResponse.json();
      spreadsheetId = createData.id;
    }

    // 3. 데이터 저장 (JSON 문자열로 A1 셀에 저장, B1에 타임스탬프)
    const timestamp = new Date().toLocaleString('ko-KR');
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:B1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          values: [[JSON.stringify(data), timestamp]],
        }),
      }
    );

    return true;
  } catch (error) {
    console.error('Save failed:', error);
    throw error;
  }
};

// 시트에서 데이터 불러오기
export const loadFromGoogleSheet = async (token: string) => {
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id)`,
      { headers }
    );
    const searchData = await searchResponse.json();
    const spreadsheetId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    if (!spreadsheetId) return null;

    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:A1`,
      { headers }
    );
    const getData = await getResponse.json();
    
    if (getData.values && getData.values[0]) {
      return JSON.parse(getData.values[0][0]);
    }
    return null;
  } catch (error) {
    console.error('Load failed:', error);
    throw error;
  }
};
