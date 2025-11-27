import express from "express";
import axios from "axios";
import pg from "pg";
import bodyParser from "body-parser";
import env from "dotenv";


env.config();

const app = express();
const port = process.env.PORT || 3000;
const yourAPIKey = process.env.BOOK_API_KEY;


const db = new pg.Client({
    user:process.env.DB_USER,
    host:process.env.DB_HOST ,
    database:process.env.DB_NAME,
    password:process.env.DB_PASSWORD ,
    port:process.env.DB_PORT,
    ssl: {
     rejectUnauthorized: false, // Required for Render PostgreSQL
        },
      
      family: 4,
  });

  db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json()); 
app.set('view engine', 'ejs');

console.log("Render assigned PORT:", process.env.PORT);


let books=[];

async function fetchImageUrls(books) {
  const imagePromises = books.map(async (book) => {
      try {
          const response = await axios.get(`https://openlibrary.org/isbn/${book.isbn}.json`,{ 
            headers: {
            'User-Agent': 'NextRead-Project/1.0 (sweta15965@gmail.com)',
           }
        });
          const imageUrl = `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`;
          return { isbn: book.isbn, imageUrl: imageUrl };
      } catch (error) {
          console.error(`Error fetching image URL for ISBN ${book.isbn}:`, error);
          return null;
      }
  });

  return Promise.all(imagePromises);
}

async function updateDatabase(imageUrls) {
  const insertOrUpdatePromises = imageUrls.map(async ({ isbn, imageUrl }) => {
      try {
          await db.query("INSERT INTO bookdata (isbn, image_url) VALUES ($1, $2) ON CONFLICT (isbn) DO UPDATE SET image_url = EXCLUDED.image_url",
              [isbn, imageUrl]);
      } catch (error) {
          console.error(`Error inserting/updating image URL for ISBN ${isbn}:`, error);
      }
  });

  await Promise.all(insertOrUpdatePromises);
}



// app.get("/update-images", async (req, res) => {
//   try {
//     const result = await db.query("SELECT * FROM books ORDER BY id ASC");
//     const books = result.rows;

//     const imageUrls = await fetchImageUrls(books);
//     await updateDatabase(imageUrls);

//     res.send("Image URLs updated.");
//   } catch (err) {
//     console.error('Error updating images:', err);
//     res.status(500).send('Error updating images');
//   }
// });






app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM bookdata ORDER BY id ASC");
    const books = result.rows;

    res.render("index.ejs", {
      bookItems: books,
    });
  } catch (err) {
    console.error('Error processing request:', err);
    res.status(500).send('Internal Server Error');
  }
});



// To Add New Book Data
app.post("/Newbooks", async (req, res) => {
  try {
      const { isbn, title,dateRead, recommendation,summary } = req.body;
             // Check if the book already exists in the database
          const existingBook = await db.query("SELECT * FROM bookdata WHERE isbn = $1", [isbn]);
          if (existingBook.rows.length > 0) {
            return res.status(400).json({ message: "Book with this ISBN already exists" });
          }
    // Insert the new book data into the database
      const result = await db.query("INSERT INTO bookdata (isbn,book_title,date_of_reading,recommendation,summary) VALUES ($1, $2, $3, $4, $5)", 
          [isbn, title,dateRead, recommendation,summary]);
        //   console.log(result);
          res.redirect("/");
  } catch (error) {
      console.error("Error adding new book:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});


// data for a new book
const newBookData = {
    isbn: "9781984897145",
    title: "Stranger Things Runaway Max by Brenna Yovanoff",
    dateRead: "2022-12-01",
    recommendation: 9,
    summary: "Runaway Max explores Max Mayfield’s backstory, offering readers a fresh perspective on the events of Stranger Things Season 2. It delves into her relationship with her brother Billy and their journey to Hawkins, Indiana. Through Max’s eyes, the novel uncovers the challenges she faces growing up in a strange town, while highlighting themes of family, identity, and belonging. The book provides deeper insight into her character and motivations within the Stranger Things universe."


};

// function to add new book data
async function addNewBook(bookData) {
try {
    const response = await axios.post('http://localhost:3000/Newbooks',bookData);
    // console.log(response.data);
} catch (error) {
    console.error('Error adding new book:', error);
}
}

// Call the function to add new book data
// addNewBook(newBookData);





// To Delete Book Data
app.delete("/books/:isbn", async (req, res) => {
  try {
      const isbn = req.params.isbn;
      
      // Check if the book exists in the database
      const existingBook = await db.query("SELECT * FROM bookdata WHERE isbn = $1", [isbn]);
      if (existingBook.rows.length === 0) {
        return res.status(404).json({ message: "Book with this ISBN not found" });
      }
      
      // Delete the book from the database
      await db.query("DELETE FROM bookdata WHERE isbn = $1", [isbn]);
      
      res.status(200).json({ message: `Book with ISBN ${isbn} deleted successfully` });
  } catch (error) {
      console.error("Error deleting book:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});

async function deleteBook(isbnToDelete) {
  try {
      const response = await axios.delete(`http://localhost:3000/books/${isbnToDelete}`);
      console.log(response.data.message);
  } catch (error) {
      console.error('Error deleting book:', error);
  }
}

// Call the function to delete a book by its ISBN
// deleteBook("0465026427");






app.get("/books/sortedByRating", async (req, res) => {
  try {
      // Fetch data from the database and sort by rating
      const result = await db.query("SELECT * FROM bookdata ORDER BY recommendation DESC");
      const books=result.rows;
      res.render("index.ejs", { bookItems:books });
  } catch (error) {
      console.error("Error fetching sorted books by rating:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/books/sortedByRecency", async (req, res) => {
  try {
      // Fetch data from the database and sort by recency
      const result = await db.query("SELECT * FROM bookdata ORDER BY date_of_reading DESC");
      const books=result.rows;
      res.render("index.ejs", { bookItems: books });
  } catch (error) {
      console.error("Error fetching sorted books by recency:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});

// Start the server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
















