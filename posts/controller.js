import Post from './model';
/**
* GET BY ID
**/
export const fetchPostById = async (req, res) => {
  try {
    res.status(200).json({ post: await Post.findById(req.params.id) });
  } catch (e) {
    res.status(e.status).json({ error: true, message: e.message });
  }
};
