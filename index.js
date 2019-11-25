const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname), {
    etag: true,
    maxage: 0,
}));

const PORT = 8080;

app.listen(PORT, () => {
    console.info(`Web server listen on port '${PORT}'`);
});
