const { plantcare, collectionofficer, marketPlace } = require('../startup/database');

exports.deleteNews = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM content WHERE id = ?';
        plantcare.query(sql, [id], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

exports.updateNews = (newsData, id) => {
    return new Promise((resolve, reject) => {
        const { titleEnglish, titleSinhala, titleTamil, descriptionEnglish, descriptionSinhala, descriptionTamil, image,  publishDate, expireDate } = newsData;
        
        let sql = `
            UPDATE content 
            SET 
                titleEnglish = ?, 
                titleSinhala = ?, 
                titleTamil = ?, 
                descriptionEnglish = ?, 
                descriptionSinhala = ?, 
                descriptionTamil = ?,
                publishDate = ?,
                expireDate = ?
        `;
        
        let values = [
            titleEnglish,
            titleSinhala,
            titleTamil,
            descriptionEnglish,
            descriptionSinhala,
            descriptionTamil,
            publishDate,
            expireDate
        ];

        if (image) {
            sql += `, image = ?`;  
            values.push(image);
        }

        sql += ` WHERE id = ?`;
        values.push(id);

        plantcare.query(sql, values, (err, results) => {
            if (err) {
                console.log(err);
                
                return reject(err);
            }
            resolve(results);
        });
    });
};


exports.geNewsById = (id) => {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM content WHERE id = ?";
      plantcare.query(sql, [id], (err, results) => {
        if (err) {
          return reject(err);
        }
        if (results.length === 0) {
          return resolve(null); 
        }
        resolve(results[0]); 
      });
    });
  };