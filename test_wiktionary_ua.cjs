const https = require('https');

function testWiktionary(word) {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    console.log(`Fetching: ${url}`);

    const options = {
        headers: {
            'User-Agent': 'EbookReader/1.0 (mailto:admin@example.com)' // Polite User-Agent
        }
    };

    https.get(url, options, (res) => {
        console.log(`Status: ${res.statusCode}`);

        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                if (res.statusCode !== 200) {
                    console.log('Response not OK');
                    console.log('Body:', data);
                    return;
                }

                const jsonData = JSON.parse(data);
                console.log('Data received:');
                console.log(JSON.stringify(jsonData, null, 2));

                if (jsonData.en && jsonData.en.length > 0) {
                    console.log('Structure matches expectation (data.en exists)');
                } else {
                    console.log('Structure DOES NOT match expectation (data.en missing or empty)');
                }
            } catch (e) {
                console.error('Error parsing JSON:', e);
                console.log('Raw data:', data);
            }
        });

    }).on('error', (err) => {
        console.error('Error:', err);
    });
}

testWiktionary('hello');
