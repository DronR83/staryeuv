// Sert le fichier Digital Asset Links avec le bon Content-Type.
// Passe par une fonction serverless pour éviter la réécriture SPA de React.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200).send(JSON.stringify([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'app.vercel.staryeuv.twa',
        sha256_cert_fingerprints: [
          '54:5A:D5:74:7E:01:A2:76:80:96:32:B8:53:82:BE:92:20:24:D7:8D:D5:5C:4E:21:32:18:4E:57:5A:7E:67:66',
          'C6:99:3C:8C:32:01:40:B1:32:24:BF:9E:24:FC:32:3F:7E:C0:78:4E:FE:BC:37:27:46:E1:24:CF:B4:57:94:3B'
        ]
      }
    }
  ]));
};
