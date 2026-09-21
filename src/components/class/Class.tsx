import { Box, Button, Modal, Typography } from "@mui/material";
import { useLoaderData, useNavigate } from "react-router";
import "./Class.css";

export function Class() {
  const { id, mode } = useLoaderData();
  const navigate = useNavigate();
  const tables = new Array(10 * 8).fill(null).map((_, index) => {
    return <div key={index} className="bg-purple-100"></div>;
  });
  console.log(tables);
  return (
    <>
      <div className="tables  h-auto m-2 border bg-pink-50 grid grid-cols-10 divide-x-1 divide-y-1">
        {tables}
      </div>

      <Modal disableEnforceFocus open={!!mode}>
        <Box
          sx={{
            position: "absolute",
            top: "2%",
            left: "2%",
            width: "96%",
            height: "96%",
            bgcolor: "var(--color-pink-50)",
            boxShadow: 24,
            p: 4,
          }}
        >
          <div className="h-1/1 flex flex-col justify-between">
            <div>
              <Typography id="modal-modal-title" variant="h6" component="h2">
                Klasseninformationen
              </Typography>
              <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                Duis mollis, est non commodo luctus, nisi erat porttitor ligula.
                <Button>Test</Button>
              </Typography>
            </div>
            <div className="self-end flex gap-2">
              <Button variant="contained">Speichern</Button>
              <Button
                color="error"
                onClick={() => {
                  if (mode == "new") navigate(-1);
                  else navigate("/class/" + id);
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </Box>
      </Modal>
    </>
  );
}
